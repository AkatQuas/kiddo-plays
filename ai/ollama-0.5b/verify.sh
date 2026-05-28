curl -s http://localhost:11434/api/tags > /dev/null && echo "✅ 服务启动成功" && \
curl -s http://localhost:11434/api/tags | grep -q "qwen:0.5b-chat" && echo "✅ 模型已加载" && \
echo "🗣  正在测试对话..." && \
curl -s http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen:0.5b-chat",
    "prompt": "你好",
    "stream": false
  }' \
echo -e "\n🎉 全部测试通过！"
