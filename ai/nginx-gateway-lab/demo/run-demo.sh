#!/usr/bin/env bash
# =============================================================
# API Gateway Demo Script — NGINX 网关演示
# 用法: bash demo/run-demo.sh   (需先启动 nginx + services)
# =============================================================

GATEWAY="http://localhost:8080"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  API Gateway Demo — NGINX 转发实战${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 1. 网关状态${NC}"
echo -e "   curl ${GATEWAY}/gateway/status"
curl -s ${GATEWAY}/gateway/status
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 2. 服务转发 — GET /api/users → users-service:3001${NC}"
echo -e "   (nginx proxy_pass http://users_upstream/)"
echo -e "   curl ${GATEWAY}/api/users"
curl -s ${GATEWAY}/api/users
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 3. 路径重写 (Strip Path) — /api/users/1 → /users/1${NC}"
echo -e "   proxy_pass http://users_upstream/;  末尾的 / 自动去掉前缀"
echo -e "   curl ${GATEWAY}/api/users/1"
curl -s ${GATEWAY}/api/users/1
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 4. 查询参数透传 — /api/products/search?q=laptop${NC}"
echo -e "   curl '${GATEWAY}/api/products/search?q=laptop'"
curl -s "${GATEWAY}/api/products/search?q=laptop"
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 5. POST 请求转发${NC}"
echo -e "   curl -X POST ${GATEWAY}/api/users -d '{\"name\":\"Demo\"}'"
curl -s -X POST ${GATEWAY}/api/users -H 'Content-Type: application/json' \
  -d '{"name":"Demo User","email":"demo@test.com"}'
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 6. 未匹配路由 → 404${NC}"
echo -e "   curl ${GATEWAY}/api/unknown-path"
curl -s -w " [HTTP %{http_code}]" ${GATEWAY}/api/unknown-path
echo -e "\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 7. 响应头中查看转发信息${NC}"
echo -e "   curl -v ${GATEWAY}/api/orders 2>&1 | grep -i 'X-Gateway\\|X-Forwarded'"
curl -s -o /dev/null -v ${GATEWAY}/api/orders 2>&1 | grep -i -E 'X-Gateway|X-Forwarded|HTTP/'
echo ""

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 8. 限流测试 (Rate Limiting)${NC}"
echo -e "   limit_req zone=global_limit burst=20 nodelay (60r/m)"
LIMIT_HIT=0
for i in $(seq 1 65); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" ${GATEWAY}/api/products 2>/dev/null)
  if [ "$CODE" = "429" ]; then
    echo -e "   ${RED}⛔ 第 ${i} 次请求被限流 (429)${NC}"
    LIMIT_HIT=1
    break
  fi
done
[ "$LIMIT_HIT" = "0" ] && echo -e "   ${GREEN}✅ 65 次全部通过（burst 允许突发，不一定触发）${NC}"
echo -e "   ${CYAN}提示: 调低 rate=10r/m 再测更容易触发${NC}\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 9. 上游宕机容错测试${NC}"
echo -e "   (停掉一个上游服务后请求)"
echo -e "   NGINX 被动健康检查: max_fails=3 fail_timeout=30s"
echo -e "   ${CYAN}命令: kill \$(lsof -ti:3001) && curl ${GATEWAY}/api/users${NC}\n"

# -------------------------------------------------------------
echo -e "${YELLOW}▶ 10. WebSocket 聊天测试${NC}"
echo -e "   通过 NGINX 网关代理 WebSocket 连接到 chat-service:3004"
echo -e "   启动一个 CLI 聊天客户端 (按 Ctrl+C 退出)"
echo ""
echo -e "   ${CYAN}提示: 开另一个终端再跑一次，两个客户端可以对话${NC}"
echo -e "   ${CYAN}     浏览器也可以打开 http://localhost:8080/chat.html${NC}"
echo ""
read -p "   ⏎ 回车启动聊天客户端... "
node demo/chat-client.js "Demo-User-$$"
echo ""
echo -e "${CYAN}  查看访问日志: cat logs/gateway-access.log${NC}"
echo -e "${CYAN}  查看转发详情: cat logs/access.log${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"