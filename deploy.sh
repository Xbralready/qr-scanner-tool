#!/bin/bash

# QR扫描工具部署脚本
# 用途: 自动构建和部署前后端应用

set -e  # 遇到错误立即退出

echo "🚀 开始部署 QR 扫描工具..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查函数
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: $1 未安装${NC}"
        exit 1
    fi
}

# 检查必要的命令
echo -e "${BLUE}检查依赖...${NC}"
check_command "node"
check_command "npm"

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "${BLUE}项目目录: ${PROJECT_ROOT}${NC}"

# 清理之前的构建
echo -e "${YELLOW}清理之前的构建...${NC}"
rm -rf "${PROJECT_ROOT}/frontend/dist"

# 1. 构建前端
echo -e "${BLUE}📦 构建前端应用...${NC}"
cd "${PROJECT_ROOT}/frontend"

# 检查是否存在 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装前端依赖...${NC}"
    npm install
fi

# 构建前端
echo -e "${YELLOW}构建前端...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端构建成功${NC}"
else
    echo -e "${RED}❌ 前端构建失败${NC}"
    exit 1
fi

# 2. 安装后端依赖
echo -e "${BLUE}📦 准备后端应用...${NC}"
cd "${PROJECT_ROOT}/backend"

# 检查是否存在 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装后端依赖...${NC}"
    npm install
fi

# 3. 创建生产环境配置
echo -e "${BLUE}📝 创建生产环境配置...${NC}"

# 创建后端 .env 文件 (如果不存在)
if [ ! -f "${PROJECT_ROOT}/backend/.env" ]; then
    echo -e "${YELLOW}创建后端 .env 文件...${NC}"
    cat > "${PROJECT_ROOT}/backend/.env" << EOF
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
REQUEST_TIMEOUT=15000
EOF
    echo -e "${GREEN}后端 .env 文件已创建${NC}"
fi

# 创建前端 .env 文件 (如果不存在)
if [ ! -f "${PROJECT_ROOT}/frontend/.env" ]; then
    echo -e "${YELLOW}创建前端 .env 文件...${NC}"
    cat > "${PROJECT_ROOT}/frontend/.env" << EOF
VITE_API_BASE_URL=http://localhost:3001
EOF
    echo -e "${GREEN}前端 .env 文件已创建${NC}"
fi

# 4. 静态文件服务设置
echo -e "${BLUE}📁 配置静态文件服务...${NC}"

# 检查是否需要安装 serve
if ! command -v serve &> /dev/null; then
    echo -e "${YELLOW}安装 serve 工具...${NC}"
    npm install -g serve
fi

# 5. 创建启动脚本
echo -e "${BLUE}📜 创建启动脚本...${NC}"

# 创建生产启动脚本
cat > "${PROJECT_ROOT}/start-production.sh" << 'EOF'
#!/bin/bash

# 生产环境启动脚本

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 启动 QR 扫描工具 (生产模式)"

# 启动后端服务
echo "启动后端服务..."
cd "${PROJECT_ROOT}/backend"
PORT=3001 NODE_ENV=production nohup npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo "后端服务 PID: $BACKEND_PID"

# 启动前端服务
echo "启动前端服务..."
cd "${PROJECT_ROOT}/frontend"
nohup serve -s dist -l 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "前端服务 PID: $FRONTEND_PID"

# 保存 PID
echo $BACKEND_PID > "${PROJECT_ROOT}/backend.pid"
echo $FRONTEND_PID > "${PROJECT_ROOT}/frontend.pid"

echo "✅ 服务启动完成"
echo "前端访问地址: http://localhost:5173"
echo "后端API地址: http://localhost:3001"
echo "健康检查: http://localhost:3001/api/health"

echo "使用 ./stop-production.sh 停止服务"
EOF

# 创建停止脚本
cat > "${PROJECT_ROOT}/stop-production.sh" << 'EOF'
#!/bin/bash

# 生产环境停止脚本

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🛑 停止 QR 扫描工具服务"

# 停止后端服务
if [ -f "${PROJECT_ROOT}/backend.pid" ]; then
    BACKEND_PID=$(cat "${PROJECT_ROOT}/backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo "后端服务已停止 (PID: $BACKEND_PID)"
    fi
    rm "${PROJECT_ROOT}/backend.pid"
fi

# 停止前端服务
if [ -f "${PROJECT_ROOT}/frontend.pid" ]; then
    FRONTEND_PID=$(cat "${PROJECT_ROOT}/frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo "前端服务已停止 (PID: $FRONTEND_PID)"
    fi
    rm "${PROJECT_ROOT}/frontend.pid"
fi

echo "✅ 所有服务已停止"
EOF

# 给脚本添加执行权限
chmod +x "${PROJECT_ROOT}/start-production.sh"
chmod +x "${PROJECT_ROOT}/stop-production.sh"

echo -e "${GREEN}✅ 部署完成!${NC}"
echo
echo -e "${BLUE}📋 部署信息:${NC}"
echo -e "  项目根目录: ${PROJECT_ROOT}"
echo -e "  前端构建目录: ${PROJECT_ROOT}/frontend/dist"
echo -e "  后端目录: ${PROJECT_ROOT}/backend"
echo
echo -e "${BLUE}🎯 启动说明:${NC}"
echo -e "  生产启动: ${GREEN}./start-production.sh${NC}"
echo -e "  停止服务: ${GREEN}./stop-production.sh${NC}"
echo -e "  开发模式: ${GREEN}npm run dev${NC} (在对应目录)"
echo
echo -e "${BLUE}🌐 访问地址:${NC}"
echo -e "  前端应用: ${GREEN}http://localhost:5173${NC}"
echo -e "  后端API: ${GREEN}http://localhost:3001${NC}"
echo -e "  健康检查: ${GREEN}http://localhost:3001/api/health${NC}"
echo
echo -e "${YELLOW}📝 注意事项:${NC}"
echo -e "  1. 确保端口 3001 和 5173 未被占用"
echo -e "  2. 生产环境请修改 .env 文件中的域名配置"
echo -e "  3. 服务日志保存在 backend.log 和 frontend.log"