#!/bin/bash

# Vercel 部署方案脚本
# GitHub + Netlify + Vercel

set -e

echo "🚀 QR 扫描工具 - Vercel 部署方案"
echo "前端: GitHub → Netlify | 后端: GitHub → Vercel"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查必要工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: $1 未安装${NC}"
        echo "请先安装 $1"
        return 1
    fi
}

echo -e "${BLUE}检查必要工具...${NC}"
check_command "git" || exit 1
check_command "node" || exit 1
check_command "npm" || exit 1
check_command "vercel" || exit 1

echo -e "${GREEN}✅ 所有必要工具已准备就绪${NC}"

# 步骤 1: Git 初始化
echo
echo -e "${BLUE}📁 步骤 1: 初始化 Git 仓库${NC}"

cd "$PROJECT_ROOT"

if [ ! -d ".git" ]; then
    echo -e "${YELLOW}初始化 Git 仓库...${NC}"
    git init
    git add .
    git commit -m "🚀 QR Scanner Tool - Ready for Vercel deployment"
    echo -e "${GREEN}✅ Git 仓库初始化完成${NC}"
else
    echo -e "${GREEN}✅ Git 仓库已存在${NC}"
fi

# 步骤 2: GitHub 仓库设置
echo
echo -e "${BLUE}📂 步骤 2: GitHub 仓库配置${NC}"

# 检查是否已有远程仓库
if ! git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}请按照以下步骤操作：${NC}"
    echo
    echo "1. 访问 https://github.com/new"
    echo "2. 仓库名设置为: qr-scanner-tool"
    echo "3. 设为 Public（免费版需要）"
    echo "4. 不要添加 README、.gitignore 等文件"
    echo "5. 点击 'Create repository'"
    echo
    read -p "完成后，请输入您的 GitHub 用户名: " GITHUB_USERNAME

    if [ -z "$GITHUB_USERNAME" ]; then
        echo -e "${RED}错误: 请提供 GitHub 用户名${NC}"
        exit 1
    fi

    echo -e "${YELLOW}添加远程仓库...${NC}"
    git remote add origin "https://github.com/$GITHUB_USERNAME/qr-scanner-tool.git"
    git branch -M main

    echo -e "${YELLOW}推送代码到 GitHub...${NC}"
    git push -u origin main

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 代码已成功推送到 GitHub${NC}"
    else
        echo -e "${RED}❌ 推送失败，请检查 GitHub 凭据${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 远程仓库已配置${NC}"

    # 获取 GitHub 用户名
    GITHUB_URL=$(git remote get-url origin)
    GITHUB_USERNAME=$(echo $GITHUB_URL | sed -n 's/.*github\.com[:/]\([^/]*\)\/.*/\1/p')
    echo -e "GitHub 用户名: ${GREEN}$GITHUB_USERNAME${NC}"
fi

# 步骤 3: Vercel 后端部署
echo
echo -e "${BLUE}▲ 步骤 3: 部署后端到 Vercel${NC}"

cd "$PROJECT_ROOT/backend"

echo -e "${YELLOW}登录 Vercel...${NC}"
vercel login

echo -e "${YELLOW}部署后端...${NC}"
vercel --prod

echo -e "${YELLOW}获取后端 URL...${NC}"
echo "请查看 Vercel 部署输出中的 Production URL"
read -p "请输入 Vercel 后端 URL (例: https://xxx.vercel.app): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}错误: 需要后端 URL 来配置前端${NC}"
    exit 1
fi

# 确保 URL 有协议
if [[ ! "$BACKEND_URL" =~ ^https?:// ]]; then
    BACKEND_URL="https://$BACKEND_URL"
fi

echo -e "${GREEN}✅ 后端部署完成: $BACKEND_URL${NC}"

# 步骤 4: 前端构建配置
echo
echo -e "${BLUE}📦 步骤 4: 配置前端构建${NC}"

cd "$PROJECT_ROOT/frontend"

# 创建生产环境配置
echo "VITE_API_BASE_URL=$BACKEND_URL" > .env.production
echo -e "${GREEN}✅ 已创建生产环境配置${NC}"

# 测试构建
echo -e "${YELLOW}测试前端构建...${NC}"
npm install
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端构建测试成功${NC}"
else
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

# 更新 git
cd "$PROJECT_ROOT"
git add .
git commit -m "📝 配置 Vercel 生产环境"
git push

# 步骤 5: Netlify 部署指南
echo
echo -e "${BLUE}🌐 步骤 5: 部署前端到 Netlify${NC}"
echo -e "${YELLOW}请按照以下步骤操作：${NC}"
echo
echo "1. 访问 https://app.netlify.com/"
echo "2. 点击 'New site from Git'"
echo "3. 选择 'GitHub' 并授权"
echo "4. 选择 'qr-scanner-tool' 仓库"
echo "5. 配置构建设置："
echo "   - Base directory: frontend"
echo "   - Build command: npm run build"
echo "   - Publish directory: frontend/dist"
echo "6. 点击 'Deploy site'"
echo "7. 等待部署完成"
echo "8. 在 Site settings → Environment variables 中添加："
echo "   - VITE_API_BASE_URL = $BACKEND_URL"
echo "9. 重新部署网站"

# 步骤 6: 测试部署
echo
echo -e "${BLUE}🧪 步骤 6: 测试部署${NC}"
echo -e "${YELLOW}请测试以下功能：${NC}"
echo "1. 后端健康检查: $BACKEND_URL/api/health"
echo "2. 前端页面加载"
echo "3. 二维码扫描功能"
echo "4. Spider 爬虫功能"
echo "5. CSV 导出功能"

echo
echo -e "${GREEN}🎉 Vercel 部署配置完成！${NC}"
echo
echo -e "${BLUE}📋 部署信息汇总：${NC}"
echo -e "后端 URL: ${GREEN}$BACKEND_URL${NC}"
echo -e "后端健康检查: ${GREEN}${BACKEND_URL}/api/health${NC}"
echo -e "GitHub 仓库: ${GREEN}https://github.com/$GITHUB_USERNAME/qr-scanner-tool${NC}"
echo
echo -e "${BLUE}📖 重要提示：${NC}"
echo "1. Vercel 无服务器函数有执行时间限制（免费版 10 秒）"
echo "2. 如果爬虫功能超时，可能需要优化或使用其他方案"
echo "3. 每次代码更新后，Git push 会自动触发重新部署"
echo "4. 可以在 Vercel 和 Netlify 控制台查看部署状态"

echo
echo -e "${YELLOW}💡 成本说明：${NC}"
echo "- GitHub: 免费"
echo "- Netlify: 免费额度（100GB 带宽/月）"
echo "- Vercel: 免费额度（100GB 带宽/月 + 100GB-hours 函数执行）"
echo
echo -e "${GREEN}总计：完全免费！🚀${NC}"