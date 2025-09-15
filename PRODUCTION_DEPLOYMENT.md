# 生产环境部署指南

## 快速部署

### 1. 自动部署（推荐）
```bash
# 执行自动部署脚本
./deploy.sh

# 启动生产服务
./start-production.sh
```

### 2. 手动部署
```bash
# 1. 构建前端
cd frontend
npm install
npm run build

# 2. 配置后端
cd ../backend
npm install

# 3. 配置环境变量（见下文）

# 4. 启动服务
npm start
```

## 环境变量配置

### 后端环境变量 (backend/.env)
```bash
# 服务端口
PORT=3001

# 运行环境
NODE_ENV=production

# 前端URL（生产环境需要修改为实际域名）
FRONTEND_URL=https://your-frontend-domain.com

# 日志级别
LOG_LEVEL=info

# 请求超时时间
REQUEST_TIMEOUT=15000
```

### 前端环境变量 (frontend/.env)
```bash
# 后端API地址（生产环境需要修改为实际API域名）
VITE_API_BASE_URL=https://your-api-domain.com
```

## 性能优化

### 已实现的优化
- ✅ **Gzip压缩**: 减少传输数据大小
- ✅ **限流控制**: 防止API滥用
- ✅ **安全头**: Helmet安全中间件
- ✅ **静态资源优化**: Vite构建优化
- ✅ **内存管理**: 图片处理优化

### 额外优化建议
1. **CDN配置**: 使用CDN加速静态资源
2. **缓存策略**: 配置Redis缓存
3. **负载均衡**: 使用Nginx负载均衡
4. **监控告警**: 集成监控系统

## 安全配置

### 已实现的安全措施
- ✅ **HTTPS**: 生产环境强制HTTPS
- ✅ **CORS配置**: 限制跨域访问
- ✅ **请求限流**: 防止DDoS攻击
- ✅ **输入验证**: 严格的输入验证
- ✅ **安全头**: CSP、HSTS等安全头

### 额外安全建议
1. **SSL证书**: 配置有效的SSL证书
2. **防火墙**: 配置服务器防火墙
3. **日志监控**: 监控异常访问
4. **定期更新**: 定期更新依赖包

## 服务器配置

### 系统要求
- Node.js 16+
- 内存: 1GB+
- 存储: 10GB+
- 网络: 稳定的网络连接

### Nginx配置示例
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE支持
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### PM2配置（推荐）
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'qr-scanner-backend',
      script: './backend/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
EOF

# 启动服务
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 监控和日志

### 日志配置
- 后端日志: `backend.log`
- 前端日志: `frontend.log`
- 错误日志: 自动记录到对应日志文件

### 健康检查
```bash
# 检查后端服务
curl http://localhost:3001/api/health

# 检查前端服务
curl http://localhost:5173
```

### 监控指标
- CPU使用率
- 内存使用率
- 网络流量
- 响应时间
- 错误率

## 故障排除

### 常见问题
1. **端口被占用**: 检查3001和5173端口
2. **权限问题**: 确保有文件读写权限
3. **内存不足**: 监控内存使用情况
4. **网络问题**: 检查防火墙配置

### 日志查看
```bash
# 查看后端日志
tail -f backend.log

# 查看前端日志
tail -f frontend.log

# 查看PM2日志
pm2 logs qr-scanner-backend
```

### 重启服务
```bash
# 使用脚本重启
./stop-production.sh
./start-production.sh

# 使用PM2重启
pm2 restart qr-scanner-backend
```

## 备份和恢复

### 备份清单
- 应用代码
- 配置文件(.env)
- 日志文件
- 数据库(如有)

### 自动备份脚本
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
tar -czf "$BACKUP_DIR/qr-scanner-$DATE.tar.gz" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='*.log' \
  /path/to/qr-scanner-tool
```

## 更新部署

### 热更新流程
```bash
# 1. 备份当前版本
cp -r qr-scanner-tool qr-scanner-tool.backup

# 2. 更新代码
git pull origin main

# 3. 重新构建
./deploy.sh

# 4. 重启服务
./stop-production.sh
./start-production.sh
```

## 联系支持

如遇到部署问题，请检查：
1. 日志文件中的错误信息
2. 网络连接和防火墙设置
3. 系统资源使用情况
4. 环境变量配置