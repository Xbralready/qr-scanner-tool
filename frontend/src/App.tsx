import { useState } from 'react'

interface QrCode {
  content: string
  isWechatQr: boolean
  imageUrl: string
}

interface QrResult {
  index: number
  url: string
  content: string
  isWechatQr: boolean
  error?: string
  totalQRFound?: number
  allQRCodes?: QrCode[]
  depth?: number
}

// API配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function App() {
  const [urlInput, setUrlInput] = useState('')
  const [results, setResults] = useState<QrResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [scanMode, setScanMode] = useState<'normal' | 'spider'>('normal')
  const [spiderConfig, setSpiderConfig] = useState({
    maxDepth: 3,
    maxPages: 50,
    delay: 1000
  })

  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUrlInput(e.target.value)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setUrlInput(content)
      }
      reader.readAsText(file)
    }
  }

  const handleStartRecognition = async () => {
    if (scanMode === 'spider') {
      // Spider模式：只需要一个根URL
      const baseUrl = urlInput.trim().split('\n')[0]?.trim()
      if (!baseUrl) {
        alert('请输入网站根URL')
        return
      }

      setIsProcessing(true)
      setResults([])

      try {
        // 使用实时流式接口
        const response = await fetch(`${API_BASE_URL}/api/spider-scan-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseUrl,
            maxDepth: spiderConfig.maxDepth,
            maxPages: spiderConfig.maxPages,
            delay: spiderConfig.delay
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          throw new Error('无法获取响应流')
        }

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一行，可能不完整

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6))

                if (eventData.type === 'qr_found') {
                  // 实时添加发现的二维码
                  const newResult: QrResult = {
                    index: eventData.totalQRCodes,
                    url: eventData.qrData.url,
                    content: eventData.qrData.content,
                    isWechatQr: eventData.qrData.isWechatQr,
                    depth: eventData.qrData.depth,
                    totalQRFound: 1,
                    allQRCodes: [{
                      content: eventData.qrData.content,
                      isWechatQr: eventData.qrData.isWechatQr,
                      imageUrl: eventData.qrData.imageUrl || ''
                    }]
                  }

                  setResults(prev => [...prev, newResult])
                } else if (eventData.type === 'page') {
                  // 可以在这里显示页面扫描进度
                  console.log(`扫描进度: ${eventData.processedCount} 页面，找到 ${eventData.totalQRCodes} 个二维码`)
                } else if (eventData.type === 'complete') {
                  console.log('Spider爬取完成')
                } else if (eventData.type === 'error') {
                  console.error('Spider错误:', eventData.message)
                }
              } catch (parseError) {
                console.error('解析事件数据失败:', parseError)
              }
            }
          }
        }

      } catch (error) {
        console.error('Spider爬取错误:', error)
        alert('Spider爬取过程中发生错误，请检查网络连接和URL格式')
      } finally {
        setIsProcessing(false)
      }
    } else {
      // 普通模式：处理多个URL
      const urls = urlInput.trim().split('\n').filter(url => url.trim())
      if (urls.length === 0) {
        alert('请输入至少一个URL')
        return
      }
      if (urls.length > 100) {
        alert('最多支持100个URL')
        return
      }

      setIsProcessing(true)
      setResults([])

      try {
        const response = await fetch(`${API_BASE_URL}/api/scan-qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls }),
        })

        const data = await response.json()
        setResults(data.results)
      } catch (error) {
        console.error('识别错误:', error)
        alert('识别过程中发生错误，请检查：\n1. 网络连接是否正常\n2. URL是否为有效的图片链接\n3. 图片是否包含二维码')
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) {
      alert('没有可导出的数据')
      return
    }

    const csvData: any[] = []

    results.forEach(result => {
      if (result.allQRCodes && result.allQRCodes.length > 0) {
        // 如果有多个二维码，每个二维码一行
        result.allQRCodes.forEach((qrCode) => {
          csvData.push([
            result.index,
            result.url,
            qrCode.content,
            qrCode.isWechatQr ? '✅' : '❌',
            qrCode.imageUrl,
            ...(scanMode === 'spider' ? [result.depth || 0] : [])
          ])
        })
      } else {
        // 如果没有二维码或只有主要的一个
        csvData.push([
          result.index,
          result.url,
          result.content || result.error || '识别失败',
          result.isWechatQr ? '✅' : '❌',
          '',
          ...(scanMode === 'spider' ? [result.depth || 0] : [])
        ])
      }
    })

    const csvContent = [
      scanMode === 'spider'
        ? ['序号', '原始URL', '二维码内容', '是否微信二维码', '图片URL', '深度']
        : ['序号', '原始URL', '二维码内容', '是否微信二维码', '图片URL'],
      ...csvData
    ]

    const csvString = csvContent
      .map(row => row.map((cell: any) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `qr_scan_results_${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('已复制到剪贴板')
      })
      .catch(() => {
        alert('复制失败')
      })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-black text-white py-8">
        <div className="text-center">
          <h1 className="text-2xl font-normal tracking-wider">二维码识别工具</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[800px] mx-auto px-4 py-12">
        {/* Input Section */}
        <div className="space-y-6 mb-12">
          {/* Mode Selection */}
          <div className="space-y-3">
            <label className="block font-medium text-gray-700 text-base">扫描模式:</label>
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scanMode"
                  value="normal"
                  checked={scanMode === 'normal'}
                  onChange={(e) => setScanMode(e.target.value as 'normal' | 'spider')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">普通模式（直接扫描指定页面）</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="scanMode"
                  value="spider"
                  checked={scanMode === 'spider'}
                  onChange={(e) => setScanMode(e.target.value as 'normal' | 'spider')}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Spider模式（自动爬取整个网站）</span>
              </label>
            </div>
          </div>

          {/* Spider Configuration */}
          {scanMode === 'spider' && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-700 text-sm">Spider参数设置:</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大深度 (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={spiderConfig.maxDepth}
                    onChange={(e) => setSpiderConfig(prev => ({...prev, maxDepth: parseInt(e.target.value) || 3}))}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">最大页面数 (1-200)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={spiderConfig.maxPages}
                    onChange={(e) => setSpiderConfig(prev => ({...prev, maxPages: parseInt(e.target.value) || 50}))}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">延时(ms) (500-10000)</label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    value={spiderConfig.delay}
                    onChange={(e) => setSpiderConfig(prev => ({...prev, delay: parseInt(e.target.value) || 1000}))}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                注意：Spider模式会自动爬取网站的所有页面，请合理设置参数避免对目标网站造成过大压力
              </p>
            </div>
          )}

          {/* URL Input */}
          <div className="space-y-3">
            <label htmlFor="url-input" className="block font-medium text-gray-700 text-base">
              {scanMode === 'spider' ? '输入网站根URL:' : '输入网页URL（每行一个）:'}
            </label>
            <textarea
              id="url-input"
              value={urlInput}
              onChange={handleTextInputChange}
              placeholder={scanMode === 'spider'
                ? "请输入网站根URL，Spider会自动爬取所有页面\n例如：https://www.53shop.com/"
                : "请输入网页URL，系统会自动扫描网页中的二维码\n例如：https://example.com\n支持最多100个URL"
              }
              rows={scanMode === 'spider' ? 3 : 10}
              className="w-full p-4 border-2 border-gray-300 rounded-md bg-white text-gray-900 text-sm leading-6 resize-y focus:outline-none focus:border-gray-600 transition-all duration-200"
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label htmlFor="file-input" className="block text-sm text-gray-600">
              或上传文本文件:
            </label>
            <input
              id="file-input"
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="w-full p-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleStartRecognition}
            disabled={isProcessing}
            className="bg-gray-800 text-white border-none px-8 py-3 text-base rounded-md cursor-pointer transition-all duration-200 min-w-[140px] hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? '处理中...' : '开始识别'}
          </button>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-6">
            <div className="w-full border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
              <table className="w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                      序号
                    </th>
                    <th className="px-4 py-3 text-left font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                      网页URL
                    </th>
                    <th className="px-4 py-3 text-left font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                      二维码内容
                    </th>
                    <th className="px-4 py-3 text-center font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                      微信二维码
                    </th>
                    <th className="px-4 py-3 text-center font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                      找到数量
                    </th>
                    {scanMode === 'spider' && (
                      <th className="px-4 py-3 text-center font-semibold border-b-2 border-gray-200 text-gray-800 text-sm">
                        深度
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => {
                    // 如果有多个二维码，显示所有的
                    if (result.allQRCodes && result.allQRCodes.length > 0) {
                      return result.allQRCodes.map((qrCode, qrIndex) => (
                        <tr key={`${result.index}-${qrIndex}`} className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 1 ? 'bg-gray-25' : ''}`}>
                          <td className="px-4 py-3 border-b border-gray-100 text-sm">
                            {qrIndex === 0 ? result.index : ''}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600 max-w-[200px]" title={result.url}>
                            {qrIndex === 0 && (
                              <div className="break-all">
                                {result.url.length > 50 ? result.url.substring(0, 50) + '...' : result.url}
                              </div>
                            )}
                          </td>
                          <td
                            className="px-4 py-3 border-b border-gray-100 text-sm cursor-pointer hover:text-black hover:bg-gray-100 transition-colors duration-150 max-w-[300px]"
                            title={qrCode.content}
                            onClick={() => copyToClipboard(qrCode.content)}
                          >
                            <div className="break-words">
                              {qrCode.content}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-center text-lg">
                            {qrCode.isWechatQr ? '✅' : '❌'}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-center text-sm">
                            {qrIndex === 0 ? result.totalQRFound || result.allQRCodes?.length || 0 : ''}
                          </td>
                          {scanMode === 'spider' && (
                            <td className="px-4 py-3 border-b border-gray-100 text-center text-sm">
                              {qrIndex === 0 ? (result as any).depth || 0 : ''}
                            </td>
                          )}
                        </tr>
                      ));
                    } else {
                      // 如果没有找到二维码或只有一个，显示原来的格式
                      return (
                        <tr key={result.index} className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 1 ? 'bg-gray-25' : ''}`}>
                          <td className="px-4 py-3 border-b border-gray-100 text-sm">
                            {result.index}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600 max-w-[200px]" title={result.url}>
                            <div className="break-all">
                              {result.url.length > 50 ? result.url.substring(0, 50) + '...' : result.url}
                            </div>
                          </td>
                          <td
                            className="px-4 py-3 border-b border-gray-100 text-sm cursor-pointer hover:text-black hover:bg-gray-100 transition-colors duration-150 max-w-[300px]"
                            title={result.content || result.error}
                            onClick={() => result.content && copyToClipboard(result.content)}
                          >
                            <div className="break-words">
                              {result.content || result.error || '识别失败'}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-center text-lg">
                            {result.isWechatQr ? '✅' : '❌'}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-center text-sm">
                            {result.totalQRFound || (result.content ? 1 : 0)}
                          </td>
                          {scanMode === 'spider' && (
                            <td className="px-4 py-3 border-b border-gray-100 text-center text-sm">
                              {(result as any).depth || 0}
                            </td>
                          )}
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>

            {/* Export Button */}
            <div className="text-center">
              <button
                onClick={exportToCSV}
                className="bg-gray-600 text-white border-none px-6 py-2.5 text-sm rounded-md cursor-pointer transition-colors duration-200 hover:bg-gray-700"
              >
                导出结果 CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App