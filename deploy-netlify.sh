#!/bin/bash

# Netlify 部署准备脚本
set -e

echo "🚀 准备 Netlify 部署..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}项目目录: ${PROJECT_ROOT}${NC}"

# 1. 检查并安装前端依赖
echo -e "${BLUE}📦 检查前端依赖...${NC}"
cd "${PROJECT_ROOT}/frontend"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装前端依赖...${NC}"
    npm install
fi

# 2. 创建生产环境配置
echo -e "${BLUE}⚙️ 创建生产环境配置...${NC}"

# 提示用户输入后端 URL
echo -e "${YELLOW}请输入后端 API URL（例如：https://your-backend.railway.app）:${NC}"
read -p "后端 URL: " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}错误: 请提供后端 URL${NC}"
    exit 1
fi

# 创建生产环境配置
echo "VITE_API_BASE_URL=${BACKEND_URL}" > .env.production
echo -e "${GREEN}已创建 .env.production 文件${NC}"

# 3. 构建前端
echo -e "${BLUE}🔨 构建前端应用...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端构建成功${NC}"
else
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

# 4. 准备部署文件
echo -e "${BLUE}📁 准备部署文件...${NC}"

# 检查构建输出
if [ -d "dist" ]; then
    echo -e "${GREEN}构建输出目录: $(pwd)/dist${NC}"
    echo -e "${GREEN}文件数量: $(find dist -type f | wc -l)${NC}"
    echo -e "${GREEN}总大小: $(du -sh dist | cut -f1)${NC}"
else
    echo -e "${RED}错误: 构建目录 'dist' 不存在${NC}"
    exit 1
fi

# 5. 显示下一步操作
echo
echo -e "${GREEN}🎉 Netlify 部署准备完成！${NC}"
echo
echo -e "${BLUE}📋 下一步操作：${NC}"
echo
echo -e "${YELLOW}方法一：拖拽部署（快速）${NC}"
echo "1. 访问 https://app.netlify.com/drop"
echo "2. 拖拽 frontend/dist 文件夹到页面中"
echo "3. 等待部署完成"
echo
echo -e "${YELLOW}方法二：Git 连接部署（推荐）${NC}"
echo "1. 将代码推送到 GitHub："
echo "   git init"
echo "   git add ."
echo "   git commit -m 'Ready for Netlify deployment'"
echo "   git remote add origin https://github.com/yourusername/qr-scanner-tool.git"
echo "   git push -u origin main"
echo
echo "2. 在 Netlify 中连接 GitHub 仓库"
echo "3. 设置构建配置："
echo "   Base directory: frontend"
echo "   Build command: npm run build"
echo "   Publish directory: frontend/dist"
echo
echo "4. 添加环境变量："
echo "   VITE_API_BASE_URL = ${BACKEND_URL}"
echo
echo -e "${BLUE}📖 详细指南：${NC}查看 NETLIFY_DEPLOYMENT.md"
echo
echo -e "${YELLOW}💡 提示：${NC}"
echo "- 部署完成后，记得在后端配置中添加 Netlify 域名到 CORS 白名单"
echo "- Netlify 会自动提供 HTTPS 和 CDN 加速"
echo "- 可以在 Netlify 控制台中设置自定义域名"