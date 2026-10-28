#!/bin/bash

cd "$(dirname "$0")"

echo "🚀 启动 QuickShare 局域网文件共享服务器..."
echo ""

if ! command -v uv >/dev/null 2>&1; then
    echo "❌ 错误: 未找到 uv"
    echo "   安装说明: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

echo "📦 按锁文件同步依赖..."
uv sync --frozen

echo "✅ 依赖已就绪"
echo ""
echo "🌐 启动服务器..."
echo "📱 本地访问: http://localhost:9527"
echo "🌍 局域网访问: http://[本机IP]:9527"
echo "⏹️  按 Ctrl+C 停止服务器"
echo ""

uv run quickshare
