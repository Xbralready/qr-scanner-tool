# 智能网页二维码扫描工具

一个支持 PC 端访问的智能二维码识别工具。输入网页URL，系统会自动扫描网页中的所有图片，找到并识别二维码内容，判断是否为微信二维码。

## 功能特性

- ✅ **智能网页扫描**：输入网页URL，自动扫描所有图片找到二维码
- ✅ **批量处理**：支持最多100个网页URL同时处理
- ✅ **多格式支持**：PNG、JPG、JPEG、GIF、WEBP等图片格式
- ✅ **相对路径处理**：自动处理网页中的相对路径图片
- ✅ **微信二维码识别**：智能判断是否为微信二维码
- ✅ **黑白灰简洁界面**：专业简洁的设计风格
- ✅ **结果导出**：CSV格式导出识别结果
- ✅ **一键复制**：点击复制二维码内容到剪贴板
- ✅ **响应式设计**：适配各种屏幕尺寸

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- CSS3（黑白灰风格）

### 后端
- Node.js + Express
- Sharp（高性能图像处理）
- jsQR（纯JavaScript二维码解析）
- Cheerio（HTML解析）
- Axios（HTTP请求）

## 快速开始

### 环境要求
- Node.js 16+
- npm

### 安装与运行

1. **启动后端服务**
```bash
cd backend
npm install
npm start
```
后端服务将运行在 http://localhost:3001

2. **启动前端服务**
```bash
cd frontend
npm install
npm run dev
```
前端服务将运行在 http://localhost:5173

3. **访问应用**
打开浏览器访问：http://localhost:5173

## 使用方法

1. **输入网页URL**：在文本框中输入网页URL，每行一个（如：https://example.com）
2. **上传文件**：也可上传包含网页URL的文本文件
3. **开始扫描**：点击"开始识别"按钮，系统会自动扫描网页中的所有图片
4. **查看结果**：在表格中查看找到的二维码内容
5. **导出数据**：点击"导出结果 CSV"下载完整结果

## API接口

### POST /api/scan-qr
识别二维码内容

**请求体：**
```json
{
  "urls": ["http://example.com/qr1.png", "http://example.com/qr2.jpg"]
}
```

**响应：**
```json
{
  "success": true,
  "total": 2,
  "results": [
    {
      "index": 1,
      "url": "http://example.com/qr1.png",
      "content": "https://weixin.qq.com/r/xxx",
      "isWechatQr": true
    }
  ]
}
```

### GET /api/health
健康检查

## 项目结构

```
qr-scanner-tool/
├── frontend/          # React前端应用
│   ├── src/
│   │   ├── App.tsx   # 主应用组件
│   │   ├── App.css   # 样式文件
│   │   └── main.tsx  # 入口文件
│   └── package.json
├── backend/           # Node.js后端服务
│   ├── server.js     # 服务器主文件
│   └── package.json
└── README.md
```

## 微信二维码识别规则

系统通过以下规则判断是否为微信二维码：
- URL包含 `u.wechat.com`
- URL包含 `weixin.qq.com`
- URL包含 `mp.weixin.qq.com`
- 协议为 `weixin://`
- 协议为 `wxp://`

## 限制说明

- 单次最多处理100个URL
- 图片下载超时时间：10秒
- 支持的图片格式：PNG, JPG, JPEG, GIF, BMP
- 文件上传仅支持 .txt 格式

## 浏览器兼容性

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 生产环境部署

### 快速部署
```bash
# 执行自动部署脚本
./deploy.sh

# 启动生产服务
./start-production.sh

# 停止服务
./stop-production.sh
```

### 部署特性
- ✅ **自动化部署**: 一键部署脚本
- ✅ **环境变量**: 支持生产/开发环境配置
- ✅ **安全优化**: Helmet、CORS、限流保护
- ✅ **性能优化**: Gzip压缩、静态资源优化
- ✅ **进程管理**: 支持PM2集群模式
- ✅ **监控日志**: 完整的日志记录系统

详细部署说明请参考：[生产环境部署指南](./PRODUCTION_DEPLOYMENT.md)

## 故障排除

1. **后端启动失败**：检查端口3001是否被占用
2. **前端连接失败**：确认后端服务已启动
3. **图片无法识别**：检查图片URL是否可访问且包含二维码
4. **导出功能异常**：确认浏览器支持文件下载
5. **部署问题**：查看 backend.log 和 frontend.log 日志文件