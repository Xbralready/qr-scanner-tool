# 🚀 推荐部署方案

## 方案选择：GitHub + Netlify + Railway

- **前端**: GitHub → Netlify (自动构建部署)
- **后端**: Railway (一键部署)
- **域名**: 免费子域名或自定义域名

## 📋 完整部署流程

### 步骤一：准备 Git 仓库

```bash
# 1. 初始化 Git
cd /Users/xuebangrui/Desktop/qr-scanner-tool
git init

# 2. 添加所有文件
git add .

# 3. 首次提交
git commit -m "🚀 QR Scanner Tool - Ready for deployment"
```

### 步骤二：创建 GitHub 仓库

1. 访问 [GitHub](https://github.com)
2. 点击 "New repository"
3. 仓库名：`qr-scanner-tool`
4. 设为 Public（Netlify 免费版需要）
5. 不要添加 README、.gitignore 等文件
6. 点击 "Create repository"

```bash
# 连接远程仓库（替换为您的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/qr-scanner-tool.git
git branch -M main
git push -u origin main
```

### 步骤三：部署后端到 Railway

```bash
# 1. 登录 Railway
railway login

# 2. 进入后端目录
cd backend

# 3. 初始化 Railway 项目
railway init

# 4. 设置环境变量
railway variables set NODE_ENV=production
railway variables set PORT=3001

# 5. 部署
railway up
```

部署完成后，Railway 会给您一个 URL，类似：
`https://qr-scanner-backend-production-xxxx.up.railway.app`

### 步骤四：部署前端到 Netlify

1. 访问 [Netlify](https://netlify.com)
2. 注册/登录账号
3. 点击 "New site from Git"
4. 选择 "GitHub" 并授权
5. 选择您的 `qr-scanner-tool` 仓库
6. 配置构建设置：
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```
7. 点击 "Deploy site"

### 步骤五：配置环境变量

在 Netlify 控制台：
1. 进入 "Site settings" → "Environment variables"
2. 添加变量：
   ```
   VITE_API_BASE_URL = https://your-railway-backend-url.up.railway.app
   ```
3. 重新部署网站

## ✅ 验证部署

### 检查后端
访问：`https://your-railway-url.up.railway.app/api/health`
应该看到：`{"status":"ok","timestamp":"..."}`

### 检查前端
访问您的 Netlify URL，测试：
1. 页面正常加载
2. 输入网页 URL 进行二维码扫描
3. Spider 爬虫功能
4. CSV 导出功能

## 🔧 维护和更新

### 代码更新流程
```bash
# 1. 修改代码后提交
git add .
git commit -m "✨ 更新功能描述"
git push

# 2. 自动触发部署
# - Netlify 会自动重新构建前端
# - Railway 会自动重新部署后端
```

## 💰 成本说明

- **GitHub**: 免费
- **Netlify**: 免费额度（100GB 带宽/月）
- **Railway**: 免费额度（500小时/月 + $5 credit）

总计：**完全免费** 🎉

## 🛠️ 故障排除

### 常见问题

1. **CORS 错误**
   - 检查后端的 Railway URL 是否正确配置在 Netlify 环境变量中
   - 确认后端 CORS 设置正确

2. **构建失败**
   - 检查 Netlify 构建日志
   - 确认 package.json 依赖完整

3. **API 无响应**
   - 检查 Railway 后端是否正常运行
   - 查看 Railway 日志

### 监控工具
- **Netlify**: 内置分析和错误监控
- **Railway**: 内置日志和监控面板
- **Uptime**: 可使用 UptimeRobot 等服务监控可用性

## 🚀 高级配置

### 自定义域名
1. **Netlify**: Site settings → Domain management
2. **Railway**: Project settings → Custom domain

### 性能优化
- Netlify 自动提供 CDN 和缓存
- Railway 自动伸缩和负载均衡

### 安全加固
- 所有连接自动 HTTPS
- 定期更新依赖包
- 监控访问日志

这个方案提供了最佳的开发体验和最低的维护成本！