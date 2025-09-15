# Netlify 部署故障排除指南

## ❌ "Project has not yet been deployed" 问题解决

### 🔍 问题诊断步骤

#### 1. 检查 Netlify 构建日志
1. 登录 Netlify 控制台
2. 点击您的项目
3. 查看 "Deploys" 标签页
4. 点击最新的部署查看详细日志

#### 2. 常见错误和解决方案

**错误类型A：Node.js 版本问题**
```
Error: Node.js version X is not supported
```
**解决方案**：在 Netlify 控制台设置环境变量
- `NODE_VERSION = 18`

**错误类型B：构建命令失败**
```
Error: Command "npm run build" failed
```
**解决方案**：检查构建配置

**错误类型C：依赖安装失败**
```
Error: npm install failed
```
**解决方案**：清理依赖缓存

### 🛠️ 解决方案

#### 方案一：修正 Netlify 设置（推荐）

1. **进入项目设置**
   - Site settings → Build & deploy → Continuous Deployment

2. **更新构建设置**
   ```
   Base directory: frontend
   Build command: npm ci && npm run build
   Publish directory: frontend/dist
   ```

3. **设置环境变量**
   - Site settings → Environment variables
   - 添加：`NODE_VERSION = 18`
   - 添加：`VITE_API_BASE_URL = https://qr-scanner-backend-rho.vercel.app`

4. **重新部署**
   - Deploys → Trigger deploy → Deploy site

#### 方案二：手动拖拽部署

如果自动构建继续失败，可以使用手动部署：

1. **本地构建**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **手动上传**
   - 访问 https://app.netlify.com/drop
   - 拖拽 `frontend/dist` 文件夹

#### 方案三：重新创建站点

1. **删除现有站点**
   - Site settings → General → Delete this site

2. **重新创建**
   - 按照原始步骤重新创建

### 📋 正确的 Netlify 配置

**构建设置**
```
Repository: Xbralready/qr-scanner-tool
Base directory: frontend
Build command: npm ci && npm run build
Publish directory: frontend/dist
```

**环境变量**
```
NODE_VERSION = 18
VITE_API_BASE_URL = https://qr-scanner-backend-rho.vercel.app
CI = false
```

### 🔧 调试技巧

#### 1. 本地测试构建
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

#### 2. 检查构建输出
```bash
ls -la dist/
# 应该看到 index.html 和 assets/ 文件夹
```

#### 3. 本地预览
```bash
npm run preview
# 访问 http://localhost:4173 测试
```

### 🆘 如果仍然失败

#### 替代方案：Vercel 前端部署

如果 Netlify 持续失败，可以改用 Vercel 部署前端：

```bash
cd frontend
vercel --prod
```

配置：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 📞 获取帮助

如果问题仍然存在，请提供：
1. Netlify 构建日志截图
2. 错误信息
3. 当前的构建设置截图

我可以根据具体错误信息提供针对性解决方案。