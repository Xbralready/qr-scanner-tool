# Netlify 部署指南

## 🚀 快速部署到 Netlify

### 方法一：GitHub 连接（推荐）

#### 1. 准备 Git 仓库
```bash
cd /Users/xuebangrui/Desktop/qr-scanner-tool

# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Ready for production deployment"

# 推送到 GitHub（需要先创建远程仓库）
git remote add origin https://github.com/your-username/qr-scanner-tool.git
git branch -M main
git push -u origin main
```

#### 2. Netlify 部署设置
1. 访问 [netlify.com](https://netlify.com)
2. 注册/登录账号
3. 点击 "New site from Git"
4. 选择 GitHub，连接您的仓库
5. 配置构建设置：
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```

#### 3. 环境变量配置
在 Netlify 控制台的 "Site settings" → "Environment variables" 中添加：

```bash
# 必须配置
VITE_API_BASE_URL=https://your-backend-url.com

# 可选配置
NODE_VERSION=18
CI=false
```

### 方法二：手动部署

#### 1. 构建前端
```bash
cd /Users/xuebangrui/Desktop/qr-scanner-tool/frontend

# 安装依赖
npm install

# 创建生产环境变量
echo "VITE_API_BASE_URL=https://your-backend-url.com" > .env.production

# 构建
npm run build
```

#### 2. 手动上传
1. 访问 [netlify.com](https://netlify.com)
2. 拖拽 `frontend/dist` 文件夹到 Netlify Drop 区域
3. 获得临时域名（例如：`https://amazing-site-123456.netlify.app`）

## 🔧 后端部署选项

### 推荐的后端部署平台

#### 1. Railway（推荐）
```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 在 backend 目录部署
cd backend
railway init
railway up
```

#### 2. Heroku
```bash
# 安装 Heroku CLI 并登录
heroku login

# 在项目根目录
heroku create your-app-name

# 配置环境变量
heroku config:set NODE_ENV=production
heroku config:set PORT=3001

# 部署
git subtree push --prefix backend heroku main
```

#### 3. Vercel
```bash
# 安装 Vercel CLI
npm install -g vercel

# 在 backend 目录
cd backend
vercel

# 配置 vercel.json
```

#### 4. Render
1. 访问 [render.com](https://render.com)
2. 连接 GitHub 仓库
3. 选择 backend 目录
4. 配置构建命令：`npm install`
5. 配置启动命令：`npm start`

## ⚙️ 配置文件

### Netlify 配置已创建
- `frontend/netlify.toml` - Netlify 构建和重定向配置

### 环境变量说明

#### 前端环境变量
```bash
# 在 Netlify 控制台配置
VITE_API_BASE_URL=https://your-backend-url.com
```

#### 后端环境变量
```bash
# 在后端部署平台配置
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-netlify-url.netlify.app
NETLIFY_URL=https://your-netlify-url.netlify.app
```

## 🔗 完整部署流程

### 1. 部署后端（以 Railway 为例）
```bash
cd backend

# 安装 Railway CLI
npm install -g @railway/cli

# 登录和初始化
railway login
railway init

# 配置环境变量
railway variables set NODE_ENV=production
railway variables set PORT=3001

# 部署
railway up

# 获取后端 URL
railway domain
# 例如：https://qr-scanner-backend-production.up.railway.app
```

### 2. 部署前端到 Netlify
```bash
cd frontend

# 创建生产环境配置
echo "VITE_API_BASE_URL=https://qr-scanner-backend-production.up.railway.app" > .env.production

# 构建
npm run build

# 上传到 Netlify（或使用 Git 连接）
```

### 3. 配置域名和 HTTPS
1. 在 Netlify 控制台配置自定义域名（可选）
2. Netlify 自动提供 HTTPS
3. 更新后端 CORS 配置中的 FRONTEND_URL

## 🚨 重要注意事项

### CORS 配置
后端已配置支持 Netlify 域名：
- `*.netlify.app`
- `*.netlify.com`
- 自定义配置的域名

### 环境变量安全
- 不要在代码中硬编码 API URL
- 生产环境必须使用 HTTPS
- 定期更新依赖包

### 性能优化
- Netlify 自动提供 CDN
- 启用 Gzip 压缩（已配置）
- 图片和资源自动优化

## 📊 部署后检查清单

### ✅ 前端检查
- [ ] 网站可以正常访问
- [ ] 所有页面路由正常工作
- [ ] API 请求成功
- [ ] 二维码扫描功能正常
- [ ] Spider 爬虫功能正常
- [ ] CSV 导出功能正常

### ✅ 后端检查
- [ ] 健康检查 API 正常：`/api/health`
- [ ] CORS 配置正确
- [ ] 所有 API 端点响应正常
- [ ] 日志记录正常

### ✅ 性能检查
- [ ] 页面加载速度正常
- [ ] API 响应时间正常
- [ ] 资源加载优化

## 🛠️ 故障排除

### 常见问题

#### 1. CORS 错误
确保后端环境变量正确设置：
```bash
FRONTEND_URL=https://your-netlify-url.netlify.app
```

#### 2. 环境变量未生效
- 检查 Netlify 控制台的环境变量设置
- 重新部署前端
- 确保变量名正确（`VITE_` 前缀）

#### 3. 404 错误
- 检查 `netlify.toml` 重定向配置
- 确保前端路由配置正确

#### 4. API 请求失败
- 检查后端部署状态
- 检查网络连接
- 查看浏览器控制台错误

### 调试工具
```bash
# 检查 Netlify 部署日志
netlify logs

# 检查构建状态
netlify status

# 本地测试生产构建
npm run build
npm run preview
```

## 🔗 有用链接

- [Netlify 文档](https://docs.netlify.com/)
- [Railway 文档](https://docs.railway.app/)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [环境变量最佳实践](https://12factor.net/config)

部署完成后，您的二维码扫描工具就可以在全球范围内访问了！🎉