require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const axios = require('axios');
const sharp = require('sharp');
const jsQR = require('jsqr');
const { BrowserMultiFormatReader } = require('@zxing/library');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 安全中间件配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 压缩中间件
app.use(compression());

// 限流配置
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: NODE_ENV === 'production' ? 100 : 1000, // 生产环境更严格的限制
  duration: 60, // 每60秒
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1,
    });
  }
};

// CORS configuration for production
const getAllowedOrigins = () => {
  if (NODE_ENV === 'production') {
    // 生产环境允许的域名
    const origins = [FRONTEND_URL];

    // 如果有额外的允许域名（例如 Netlify）
    if (process.env.NETLIFY_URL) {
      origins.push(process.env.NETLIFY_URL);
    }

    // 通用 Netlify 域名模式（*.netlify.app）
    return origins.concat([
      /^https:\/\/.*\.netlify\.app$/,
      /^https:\/\/.*\.netlify\.com$/,
    ]);
  }

  // 开发环境
  return ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'];
};

const corsOptions = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 应用限流中间件到API路由
app.use('/api', rateLimiterMiddleware);

const isWechatQr = (content) => {
  if (!content) return false;

  const wechatPatterns = [
    /^https?:\/\/u\.wechat\.com/i,
    /^https?:\/\/weixin\.qq\.com/i,
    /^https?:\/\/mp\.weixin\.qq\.com/i,
    /^weixin:\/\//i,
    /^wxp:\/\//i
  ];

  return wechatPatterns.some(pattern => pattern.test(content));
};

// 新增依赖
const cheerio = require('cheerio');

const downloadWebPage = async (url, timeout = 15000) => {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('无效的URL');
    }

    const response = await axios.get(url, {
      timeout: timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('网页加载超时');
    } else if (error.response && error.response.status) {
      throw new Error(`网页加载失败: HTTP ${error.response.status}`);
    } else {
      throw new Error(`网页加载失败: ${error.message}`);
    }
  }
};

const downloadImage = async (imageUrl, baseUrl, timeout = 15000) => {
  try {
    // 处理相对路径
    let fullUrl = imageUrl;
    if (imageUrl.startsWith('//')) {
      fullUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      fullUrl = urlObj.origin + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      fullUrl = new URL(imageUrl, baseUrl).href;
    }

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: timeout,
      maxContentLength: 10 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/png, image/jpeg, image/jpg, image/gif, image/webp, */*'
      }
    });

    if (!response.data || response.data.byteLength === 0) {
      throw new Error('下载的图片为空');
    }

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`图片下载失败: ${error.message}`);
  }
};

const findQRCodesInWebPage = async (url) => {
  try {
    const html = await downloadWebPage(url);
    const $ = cheerio.load(html);
    const qrResults = [];
    const processedUrls = new Set(); // 避免重复处理

    // 查找所有图片
    const images = $('img');
    console.log(`在网页 ${url} 中找到 ${images.length} 个图片`);

    // 收集所有图片URL（包括data-src等懒加载属性）
    const imageUrls = [];
    for (let i = 0; i < images.length; i++) {
      const img = images.eq(i);
      const src = img.attr('src');
      const dataSrc = img.attr('data-src') || img.attr('data-original') || img.attr('data-lazy');
      const alt = img.attr('alt') || '';
      const title = img.attr('title') || '';

      // 检查是否是占位符图片
      const isPlaceholder = src && (
        src.includes('tpjz') ||
        src.includes('loading') ||
        src.includes('placeholder') ||
        src.includes('noimage')
      );

      // 优先使用data-src（如果是占位符）
      const actualSrc = (isPlaceholder && dataSrc) ? dataSrc : src;

      if (actualSrc && !processedUrls.has(actualSrc)) {
        processedUrls.add(actualSrc);
        imageUrls.push({
          src: actualSrc,
          alt: alt,
          title: title,
          index: i
        });
      }

      // 如果有data-src且与src不同，也加入处理
      if (dataSrc && dataSrc !== src && !processedUrls.has(dataSrc)) {
        processedUrls.add(dataSrc);
        imageUrls.push({
          src: dataSrc,
          alt: alt,
          title: title,
          index: i
        });
      }
    }

    // 另外查找可能包含二维码图片的其他元素
    $('div[style*="background-image"], span[style*="background-image"]').each((i, elem) => {
      const style = $(elem).attr('style') || '';
      const urlMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        const bgUrl = urlMatch[1];
        if (!processedUrls.has(bgUrl)) {
          processedUrls.add(bgUrl);
          imageUrls.push({
            src: bgUrl,
            alt: '背景图片',
            title: '',
            index: images.length + i
          });
        }
      }
    });

    console.log(`收集到 ${imageUrls.length} 个待检查的图片URL`);

    for (const imgData of imageUrls) {
      const { src, alt, title, index } = imgData;

      // 通过alt、title判断可能是二维码，或者包含微信相关关键词
      const isLikelyQR = /qr|code|二维码|扫码|微信|wechat|weixin|jocita|dawanqu/i.test(alt + title);

      // 通过URL判断可能是二维码
      const isLikelyQRByUrl = /qr|code|weixin|wechat/i.test(src);

      try {
        console.log(`正在检查图片 ${index + 1}: ${src.substring(0, 100)}...`);
        const imageBuffer = await downloadImage(src, url);
        const qrContent = await decodeQRCode(imageBuffer);

        qrResults.push({
          imageUrl: src,
          content: qrContent,
          isWechatQr: isWechatQr(qrContent),
          isLikelyQR: isLikelyQR || isLikelyQRByUrl
        });

        console.log(`✓ 发现二维码: ${qrContent.substring(0, 50)}...`);
      } catch (error) {
        // 不是二维码或无法处理，继续下一个
        if (isLikelyQR || isLikelyQRByUrl) {
          console.log(`✗ 疑似二维码图片处理失败: ${error.message}`);
        }
      }
    }

    return qrResults;
  } catch (error) {
    throw new Error(`网页分析失败: ${error.message}`);
  }
};

const decodeQRCode = async (imageBuffer) => {
  try {
    // 检查buffer是否有效
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('图片数据为空');
    }

    console.log(`开始识别二维码，图片大小: ${imageBuffer.length} bytes`);

    // 首先尝试 qrcode-reader + Jimp 组合 (已经证实有效)
    try {
      console.log('尝试 qrcode-reader + Jimp 方法...');
      const Jimp = require('jimp');
      const QrCode = require('qrcode-reader');

      const image = await new Promise((resolve, reject) => {
        new Jimp(imageBuffer, (err, img) => {
          if (err) reject(err);
          else resolve(img);
        });
      });

      const qr = new QrCode();
      const result = await new Promise((resolve, reject) => {
        qr.callback = (err, value) => {
          if (err) {
            reject(err);
          } else if (value && value.result) {
            resolve(value.result);
          } else {
            reject(new Error('No QR code found'));
          }
        };
        qr.decode(image.bitmap);
      });

      console.log(`✓ qrcode-reader 识别成功: ${result.substring(0, 100)}...`);
      return result;
    } catch (jimpError) {
      console.log(`qrcode-reader 识别失败: ${jimpError.message}`);
    }

    // 备用方法：jsQR 处理
    const processingMethods = [
      // 方法1：原图直接处理
      {
        name: 'jsQR原图处理',
        process: async () => {
          const { data, info } = await sharp(imageBuffer)
            .toColorspace('srgb')
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          return jsQR(new Uint8ClampedArray(data), info.width, info.height);
        }
      },

      // 方法2：遮盖中心LOGO
      {
        name: 'jsQR遮盖LOGO',
        process: async () => {
          const { data, info } = await sharp(imageBuffer)
            .toColorspace('srgb')
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          const maskedData = new Uint8ClampedArray(data);
          const centerX = Math.floor(info.width / 2);
          const centerY = Math.floor(info.height / 2);
          const maskSize = Math.floor(Math.min(info.width, info.height) * 0.15);

          for (let y = centerY - maskSize; y < centerY + maskSize; y++) {
            for (let x = centerX - maskSize; x < centerX + maskSize; x++) {
              if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
                const pixelIndex = (y * info.width + x) * 4;
                maskedData[pixelIndex] = 255;
                maskedData[pixelIndex + 1] = 255;
                maskedData[pixelIndex + 2] = 255;
                maskedData[pixelIndex + 3] = 255;
              }
            }
          }

          return jsQR(maskedData, info.width, info.height);
        }
      }
    ];

    // 尝试备用方法
    for (let i = 0; i < processingMethods.length; i++) {
      try {
        console.log(`尝试备用方法${i + 1}: ${processingMethods[i].name}`);
        const code = await processingMethods[i].process();
        if (code && code.data) {
          console.log(`✓ ${processingMethods[i].name} 识别成功: ${code.data.substring(0, 50)}...`);
          return code.data;
        }
      } catch (methodError) {
        console.log(`${processingMethods[i].name} 失败: ${methodError.message}`);
        continue;
      }
    }

    throw new Error('所有识别方法都失败了');
  } catch (error) {
    throw new Error(`图片处理失败: ${error.message}`);
  }
};

// 实时流式Spider爬取函数
const spiderScanWebsiteStream = async (baseUrl, options = {}, onEvent) => {
  const {
    maxDepth = 3,
    maxPages = 50,
    delay = 1000
  } = options;

  const visitedUrls = new Set();
  const queuedUrls = [{ url: baseUrl, depth: 0 }];
  const allQRResults = [];
  let processedCount = 0;

  console.log(`开始Spider爬取网站: ${baseUrl}`);
  console.log(`参数: 最大深度=${maxDepth}, 最大页面=${maxPages}, 延时=${delay}ms`);

  while (queuedUrls.length > 0 && processedCount < maxPages) {
    const { url: currentUrl, depth } = queuedUrls.shift();

    if (visitedUrls.has(currentUrl) || depth > maxDepth) {
      continue;
    }

    visitedUrls.add(currentUrl);
    processedCount++;

    try {
      console.log(`Spider处理页面 ${processedCount}/${maxPages} (深度${depth}): ${currentUrl}`);

      // 发送页面处理状态
      onEvent({
        type: 'page',
        message: `正在扫描页面 ${processedCount}/${maxPages}`,
        url: currentUrl,
        depth: depth,
        processedCount: processedCount,
        totalQRCodes: allQRResults.length
      });

      // 扫描当前页面的二维码
      const qrResults = await findQRCodesInWebPage(currentUrl);

      if (qrResults.length > 0) {
        console.log(`在页面 ${currentUrl} 找到 ${qrResults.length} 个二维码`);

        // 实时推送每个发现的二维码
        qrResults.forEach(qr => {
          const qrData = {
            url: currentUrl,
            depth: depth,
            content: qr.content,
            isWechatQr: qr.isWechatQr,
            imageUrl: qr.imageUrl
          };

          allQRResults.push(qrData);

          // 实时推送二维码发现事件
          onEvent({
            type: 'qr_found',
            message: `发现二维码: ${qr.isWechatQr ? '微信二维码' : '普通二维码'}`,
            qrData: qrData,
            totalQRCodes: allQRResults.length
          });
        });
      }

      // 如果还没达到最大深度，提取页面链接
      if (depth < maxDepth) {
        try {
          const response = await axios.get(currentUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const $ = cheerio.load(response.data);
          const baseUrlObj = new URL(baseUrl);

          $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (!href) return;

            try {
              let fullUrl;
              if (href.startsWith('http')) {
                fullUrl = href;
              } else if (href.startsWith('/')) {
                fullUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
              } else if (href.startsWith('./') || !href.startsWith('#')) {
                const currentUrlObj = new URL(currentUrl);
                fullUrl = new URL(href, currentUrlObj).href;
              } else {
                return;
              }

              const linkUrlObj = new URL(fullUrl);
              if (linkUrlObj.host === baseUrlObj.host && !visitedUrls.has(fullUrl)) {
                const hasSkipExtension = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|jpg|jpeg|png|gif|bmp|svg|ico|css|js|xml|json|csv|txt)$/i.test(
                  linkUrlObj.pathname
                );

                if (!hasSkipExtension) {
                  queuedUrls.push({ url: fullUrl, depth: depth + 1 });
                }
              }
            } catch (urlError) {
              // 忽略无效的URL
            }
          });
        } catch (pageError) {
          console.error(`获取页面链接失败 ${currentUrl}: ${pageError.message}`);
        }
      }

      // 添加延时
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error(`Spider处理页面失败 ${currentUrl}: ${error.message}`);
      onEvent({
        type: 'error',
        message: `页面处理失败: ${currentUrl}`,
        error: error.message
      });
    }
  }

  console.log(`Spider爬取完成，共处理 ${processedCount} 个页面，找到 ${allQRResults.length} 个二维码`);

  // 发送最终统计
  onEvent({
    type: 'summary',
    message: `爬取完成，共找到 ${allQRResults.length} 个二维码`,
    totalPages: processedCount,
    totalQRCodes: allQRResults.length,
    wechatQRCodes: allQRResults.filter(qr => qr.isWechatQr).length
  });

  return {
    totalPages: processedCount,
    totalQRCodes: allQRResults.length,
    qrResults: allQRResults,
    wechatQRCodes: allQRResults.filter(qr => qr.isWechatQr)
  };
};

// Spider爬虫功能
const spiderScanWebsite = async (baseUrl, options = {}) => {
  const {
    maxDepth = 3,
    maxPages = 50,
    delay = 1000,
    onProgress = () => {}
  } = options;

  const visitedUrls = new Set();
  const queuedUrls = [{ url: baseUrl, depth: 0 }];
  const allQRResults = [];
  let processedCount = 0;

  console.log(`开始Spider爬取网站: ${baseUrl}`);
  console.log(`参数: 最大深度=${maxDepth}, 最大页面=${maxPages}, 延时=${delay}ms`);

  while (queuedUrls.length > 0 && processedCount < maxPages) {
    const { url: currentUrl, depth } = queuedUrls.shift();

    if (visitedUrls.has(currentUrl) || depth > maxDepth) {
      continue;
    }

    visitedUrls.add(currentUrl);
    processedCount++;

    try {
      console.log(`Spider处理页面 ${processedCount}/${maxPages} (深度${depth}): ${currentUrl}`);

      // 调用进度回调
      onProgress({
        processed: processedCount,
        total: Math.min(queuedUrls.length + processedCount, maxPages),
        currentUrl,
        depth,
        qrFound: allQRResults.length
      });

      // 获取页面HTML
      const html = await downloadWebPage(currentUrl);
      const $ = cheerio.load(html);

      // 查找二维码
      const qrResults = await findQRCodesInWebPage(currentUrl);
      if (qrResults.length > 0) {
        console.log(`在页面 ${currentUrl} 找到 ${qrResults.length} 个二维码`);
        qrResults.forEach(qr => {
          allQRResults.push({
            ...qr,
            sourceUrl: currentUrl,
            depth: depth
          });
        });
      }

      // 如果还没达到最大深度，继续发现新链接
      if (depth < maxDepth) {
        const baseUrlObj = new URL(baseUrl);
        const currentUrlObj = new URL(currentUrl);

        // 查找页面中的所有链接
        $('a[href]').each((i, elem) => {
          const href = $(elem).attr('href');
          if (!href) return;

          try {
            let fullUrl;
            if (href.startsWith('http')) {
              fullUrl = href;
            } else if (href.startsWith('/')) {
              fullUrl = currentUrlObj.origin + href;
            } else if (href.startsWith('./') || !href.startsWith('#')) {
              fullUrl = new URL(href, currentUrl).href;
            } else {
              return; // 跳过锚点链接
            }

            const linkUrlObj = new URL(fullUrl);

            // 只处理同域名的链接
            if (linkUrlObj.hostname === baseUrlObj.hostname &&
                !visitedUrls.has(fullUrl) &&
                !queuedUrls.some(item => item.url === fullUrl)) {

              // 过滤掉不需要的文件类型
              const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.rar'];
              const hasSkipExtension = skipExtensions.some(ext =>
                linkUrlObj.pathname.toLowerCase().endsWith(ext)
              );

              if (!hasSkipExtension) {
                queuedUrls.push({ url: fullUrl, depth: depth + 1 });
              }
            }
          } catch (urlError) {
            // 忽略无效的URL
          }
        });
      }

      // 添加延时，避免对服务器造成过大压力
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error(`Spider处理页面失败 ${currentUrl}: ${error.message}`);
    }
  }

  console.log(`Spider爬取完成，共处理 ${processedCount} 个页面，找到 ${allQRResults.length} 个二维码`);

  return {
    totalPages: processedCount,
    totalQRCodes: allQRResults.length,
    qrResults: allQRResults,
    wechatQRCodes: allQRResults.filter(qr => qr.isWechatQr)
  };
};

const processWebPageQRCodes = async (url, index) => {
  try {
    console.log(`正在处理第${index}个网页URL: ${url}`);

    const qrResults = await findQRCodesInWebPage(url);

    if (qrResults.length === 0) {
      return {
        index,
        url,
        content: '',
        isWechatQr: false,
        error: '网页中未找到二维码'
      };
    }

    // 如果找到多个二维码，返回第一个，或者优先返回微信二维码
    const wechatQR = qrResults.find(qr => qr.isWechatQr);
    const selectedQR = wechatQR || qrResults[0];

    return {
      index,
      url,
      content: selectedQR.content,
      isWechatQr: selectedQR.isWechatQr,
      imageUrl: selectedQR.imageUrl,
      totalQRFound: qrResults.length,
      allQRCodes: qrResults.map(qr => ({
        content: qr.content,
        isWechatQr: qr.isWechatQr,
        imageUrl: qr.imageUrl
      }))
    };
  } catch (error) {
    console.error(`处理第${index}个网页URL失败:`, error.message);
    return {
      index,
      url,
      content: '',
      isWechatQr: false,
      error: error.message
    };
  }
};

app.post('/api/scan-qr', async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs参数必须是数组' });
    }

    if (urls.length === 0) {
      return res.status(400).json({ error: 'URL列表不能为空' });
    }

    if (urls.length > 100) {
      return res.status(400).json({ error: '最多支持100个URL' });
    }

    console.log(`开始处理${urls.length}个URL`);

    const results = await Promise.allSettled(
      urls.map((url, index) => processWebPageQRCodes(url.trim(), index + 1))
    );

    const processedResults = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          index: 0,
          url: '',
          content: '',
          isWechatQr: false,
          error: '处理失败'
        };
      }
    });

    console.log(`完成处理，成功识别: ${processedResults.filter(r => r.content && !r.error).length}/${urls.length}`);

    res.json({
      success: true,
      total: urls.length,
      results: processedResults
    });

  } catch (error) {
    console.error('服务器错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// Spider爬取API (实时流式输出)
app.post('/api/spider-scan-stream', async (req, res) => {
  try {
    const { baseUrl, maxDepth = 3, maxPages = 50, delay = 1000 } = req.body;

    if (!baseUrl) {
      return res.status(400).json({ error: '缺少baseUrl参数' });
    }

    // 验证URL格式
    try {
      new URL(baseUrl);
    } catch (urlError) {
      return res.status(400).json({ error: '无效的URL格式' });
    }

    // 参数验证
    if (maxDepth < 1 || maxDepth > 5) {
      return res.status(400).json({ error: '最大深度必须在1-5之间' });
    }

    if (maxPages < 1 || maxPages > 50) {
      return res.status(400).json({ error: '最大页面数必须在1-50之间' });
    }

    if (delay < 500 || delay > 5000) {
      return res.status(400).json({ error: '延时必须在500-5000ms之间' });
    }

    console.log(`收到Spider爬取请求: ${baseUrl}, 深度=${maxDepth}, 页面=${maxPages}, 延时=${delay}ms`);

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 发送初始状态
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: '开始爬取',
      totalPages: 0,
      totalQRCodes: 0
    })}\n\n`);

    // 实时爬取并推送结果
    await spiderScanWebsiteStream(baseUrl, {
      maxDepth: parseInt(maxDepth),
      maxPages: parseInt(maxPages),
      delay: parseInt(delay)
    }, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // 发送完成状态
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: 'Spider爬取完成'
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Spider爬取错误:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message
    })}\n\n`);
    res.end();
  }
});

// Spider爬取API (原有的一次性返回)
app.post('/api/spider-scan', async (req, res) => {
  try {
    // Vercel Pro 版本：支持 60 秒执行时间
    const maxDepthDefault = 2; // 合理的爬取深度
    const maxPagesDefault = 20; // 合理的页面数量
    const delayDefault = 1000;  // 合理的延迟

    const {
      baseUrl,
      maxDepth = maxDepthDefault,
      maxPages = maxPagesDefault,
      delay = delayDefault
    } = req.body;

    if (!baseUrl) {
      return res.status(400).json({ error: '缺少baseUrl参数' });
    }

    // 验证URL格式
    try {
      new URL(baseUrl);
    } catch (urlError) {
      return res.status(400).json({ error: '无效的URL格式' });
    }

    // 参数验证
    if (maxDepth < 1 || maxDepth > 5) {
      return res.status(400).json({ error: '最大深度必须在1-5之间' });
    }

    if (maxPages < 1 || maxPages > 50) {
      return res.status(400).json({ error: '最大页面数必须在1-50之间' });
    }

    if (delay < 500 || delay > 5000) {
      return res.status(400).json({ error: '延时必须在500-5000ms之间' });
    }

    console.log(`收到Spider爬取请求: ${baseUrl}, 深度=${maxDepth}, 页面=${maxPages}, 延时=${delay}ms`);

    const result = await spiderScanWebsite(baseUrl, {
      maxDepth: parseInt(maxDepth),
      maxPages: parseInt(maxPages),
      delay: parseInt(delay)
    });

    console.log(`Spider爬取完成，找到${result.totalQRCodes}个二维码，其中${result.wechatQRCodes.length}个微信二维码`);

    res.json({
      success: true,
      baseUrl,
      totalPages: result.totalPages,
      totalQRCodes: result.totalQRCodes,
      wechatQRCodes: result.wechatQRCodes.length,
      results: result.qrResults.map((qr, index) => ({
        index: index + 1,
        url: qr.sourceUrl,
        content: qr.content,
        isWechatQr: qr.isWechatQr,
        imageUrl: qr.imageUrl,
        depth: qr.depth,
        allQRCodes: [qr] // 保持与原有格式兼容
      }))
    });

  } catch (error) {
    console.error('Spider爬取错误:', error);
    res.status(500).json({
      success: false,
      error: 'Spider爬取过程中发生错误'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`二维码识别服务器启动成功，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;