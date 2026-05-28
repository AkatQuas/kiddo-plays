curl http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen:0.5b-chat",
    "prompt": "你好",
    "stream": false
  }'