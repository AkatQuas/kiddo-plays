# 🚀 API Gateway 学习项目 — 基于 NGINX 的真实转发架构

> 用 **真正的 NGINX** 搭建 API 网关，学习反向代理与网关核心原理。
> 不依赖 Docker，本地安装 NGINX + Node.js 三个模拟服务即可运行。

## 目录

- [架构速览](#架构速览)
- [NGINX 核心概念速查](#nginx-核心概念速查)
- [快速开始](#快速开始)
- [NGINX 配置文件详解](#nginx-配置文件详解)
- [核心功能深度解析](#核心功能深度解析)
- [请求处理全流程](#请求处理全流程)
- [项目结构](#项目结构)
- [进阶学习路线](#进阶学习路线)

---

## 架构速览

```
┌─ 客户端（统一入口，只认网关） ──────────────────────┐
│  curl http://localhost:8080/api/users                │
│  curl http://localhost:8080/api/orders               │
│  curl http://localhost:8080/api/products              │
│  ws://localhost:8080/ws/chat (WebSocket)              │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─ NGINX 网关 (localhost:8080) ───────────────────────┐
│                                                       │
│  upstream users_upstream  { server localhost:3001; }  │
│  upstream orders_upstream { server localhost:3002; }  │
│  upstream products_upstream{ server localhost:3003; }  │
│  upstream chat_upstream    { server localhost:3004; }  │
│                                                       │
│  location /api/users/    { proxy_pass users_upstream/; }│
│  location /api/orders/   { proxy_pass orders_upstream/; }│
│  location /api/products/ { proxy_pass products_upstream/;}│
│  location /ws/chat/      { proxy_pass chat_upstream/;  }│
│  (WebSocket: Upgrade + proxy_http_version 1.1)        │
└────────────────────┬────────────────────────────────┘
                     │ proxy_pass 转发
                     │ strip_path 去掉 /api 前缀
                     ▼
┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐
│ Users      │  │ Orders     │  │ Products     │  │ Chat(WS)     │
│ :3001      │  │ :3002      │  │ :3003        │  │ :3004        │
│ /users/*   │  │ /orders/*  │  │ /products/*  │  │ /ws/chat/*   │
└────────────┘  └────────────┘  └──────────────┘  └──────────────┘
```

---

## NGINX 核心概念速查

| 概念             | 配置指令                       | 本项目位置            | 说明              |
| ---------------- | ------------------------------ | --------------------- | ----------------- |
| **反向代理**     | `server { listen 8080; }`      | `gateway.conf`        | 网关入口          |
| **上游集群**     | `upstream {}` 块               | `upstreams.conf`      | 上游服务集群      |
| **后端实例**     | `server host:port`             | `upstreams.conf` 内部 | 后端实例          |
| **路由匹配**     | `location /path/`              | `gateway.conf`        | 路径匹配规则      |
| **请求转发**     | `proxy_pass http://upstream/;` | `gateway.conf`        | 转发到上游        |
| **路径重写**     | `proxy_pass` 末尾带 `/`        | `gateway.conf`        | 自动去掉路径前缀  |
| **负载均衡**     | upstream 的轮询算法            | `upstreams.conf`      | 加权轮询          |
| **限流**         | `limit_req_zone` + `limit_req` | `nginx.conf`          | NGINX 原生限流    |
| **被动健康检查** | `max_fails` + `fail_timeout`   | `upstreams.conf`      | 请求失败自动熔断  |
| **故障转移**     | `proxy_next_upstream`          | `gateway.conf`        | 上游失败时切换    |
| **转发头**       | `proxy_set_header`             | `gateway.conf`        | 传递客户端真实 IP |

---

## 快速开始

### 1. 安装 NGINX

```bash
brew install nginx
```

配置在本项目 `nginx/` 目录下，**不影响系统全局配置**。

### 2. 启动服务

```bash
npm start
# 或: overmind start
```

底层使用 [Overmind](https://github.com/DarthSim/overmind) 管理多进程（基于 `Procfile`）：

- `nginx` — NGINX 网关 (:8080)
- `users` — 用户服务 (:3001)
- `orders` — 订单服务 (:3002)
- `products` — 商品服务 (:3003)
- `chat` — 聊天服务 (WebSocket) (:3004)
  按 `Ctrl+C` 停止所有进程。

### 3. 验证

```bash
# 网关是否运行
curl http://localhost:8080/health

# 查看网关状态
curl http://localhost:8080/gateway/status

# 用户服务转发
curl http://localhost:8080/api/users

# 订单服务转发
curl http://localhost:8080/api/orders/1001

# 商品搜索（带查询参数）
curl 'http://localhost:8080/api/products/search?q=laptop'


# WebSocket 聊天测试
node demo/chat-client.js test-user general
```

### 4. 停止

`overmind start` 在前台运行，按 `Ctrl+C` 停止所有进程。

或手动清理：

```bash
pkill -f "nginx.*api-gateway" 2>/dev/null; lsof -ti:3001,3002,3003,3004 | xargs kill 2>/dev/null; echo 'stopped'
```

### 5. 修改配置后重载（无需重启）

```bash
nginx -c $(PWD)/nginx/nginx.conf -p $(PWD) -t     # 先检查配置语法
nginx -c $(PWD)/nginx/nginx.conf -p $(PWD) -s reload  # 热重载
```

---

## NGINX 配置文件详解

本项目配置在 `nginx/` 目录下，和系统全局配置完全隔离。

### `nginx/nginx.conf` — 主配置

```nginx
# 全局配置
worker_processes  auto;          # 自动匹配 CPU 核数
daemon off;                      # 前台运行（配合 npm start）

error_log  logs/error.log  warn; # 错误日志

events {
    worker_connections  1024;    # 每个 worker 最大并发连接
}

http {
    # 全局限流
    limit_req_zone $binary_remote_addr zone=global_limit:10m rate=60r/m;
    limit_conn_zone $binary_remote_addr zone=global_conn:10m;

    # 导入站点配置
    include sites/*.conf;
}
```

- `limit_req_zone` — 定义限流规则，基于客户端 IP，每分钟 60 次
- `proxy_next_upstream` — 上游失败时支持故障转移

### `sites/upstreams.conf` — 上游服务定义

```nginx
upstream users_upstream {
    server localhost:3001 weight=5 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

- `weight=5` — 权重（加权轮询）
- `max_fails=3 fail_timeout=30s` — **NGINX 原生熔断**：30 秒内连续失败 3 次，标记为不可用，30s 后自动恢复
- `keepalive` — 上游连接的保活连接池

同样定义 `chat_upstream`（用于 WebSocket 代理）：

```nginx
upstream chat_upstream {
    server localhost:3004 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

### `sites/gateway.conf` — 网关路由

```nginx
server {
    listen       8080;
    server_name  localhost gateway.local;

    # 全局限流
    limit_req  zone=global_limit  burst=20  nodelay;
    limit_conn  global_conn  30;

    # 通用转发头
    proxy_set_header  Host               $host;
    proxy_set_header  X-Real-IP          $remote_addr;
    proxy_set_header  X-Forwarded-For    $proxy_add_x_forwarded_for;
    proxy_set_header  X-Forwarded-Proto  $scheme;

    # Route: 用户服务
    location /api/users/ {
        proxy_pass http://users_upstream/;  # 末尾 / → strip_path
        add_header X-Gateway-Route  "users-route";
        proxy_next_upstream error timeout http_502 http_504;
    }

    # Route: 订单服务
    location /api/orders/ {
        proxy_pass http://orders_upstream/;
        add_header X-Gateway-Route  "orders-route";
    }

    # Route: 商品服务
    location /api/products/ {
        proxy_pass http://products_upstream/;
        add_header X-Gateway-Route  "products-route";
    }

    # Route: 聊天服务 (WebSocket)
    location /ws/chat/ {
        proxy_pass http://chat_upstream/ws/chat/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }

    location /chat/ {
        proxy_pass http://chat_upstream/chat/;
        add_header X-Gateway-Route  "chat-route";
    }

    # 聊天测试页面 (静态文件)
    location = /chat.html {
        alias demo/public/chat.html;
    }

    # 网关状态端点
    location = /gateway/status {
        return 200 '{"service":"gateway","status":"UP"}';
    }
}
```

### `sites/advanced.conf` — 进阶配置示例

包含灰度发布、一致性哈希、IP 亲和性、NGINX Plus 主动健康检查的配置模板。

---

## 核心功能深度解析

### 1. 反向代理 (Reverse Proxy)

反向代理是网关最核心的功能。NGINX 的 `proxy_pass` 指令完成 HTTP 转发：

```nginx
location /api/users/ {
    proxy_pass http://users_upstream/;
}
```

**工作原理：**

1. 客户端请求 `GET /api/users` 到达 NGINX
2. NGINX 匹配 `location /api/users/`
3. `proxy_pass` 将请求转发到 `users_upstream`（即 `localhost:3001`）
4. NGINX 接收上游响应，返回给客户端

**关键配置项：**

| 指令                    | 说明               |
| ----------------------- | ------------------ |
| `proxy_pass`            | 指定转发的目标地址 |
| `proxy_set_header`      | 修改/添加请求头    |
| `proxy_connect_timeout` | 连接上游超时       |
| `proxy_read_timeout`    | 读取上游响应超时   |

### 2. 路径重写 (Strip Path)

客户端请求 `/api/users/1`，上游服务只认得 `/users/1`。NGINX 通过 `proxy_pass` 的 URL 末尾是否带 `/` 来控制路径重写：

```nginx
# 情况 1: 末尾带 / → strip_path，去掉 /api/users 前缀
# 请求 /api/users/1  →  上游收到 /1
location /api/users/ {
    proxy_pass http://users_upstream/;
}

# 情况 2: 末尾不带 / → 完整路径传递
# 请求 /api/users/1  →  上游收到 /api/users/1
location /api/users/ {
    proxy_pass http://users_upstream;
}
```

### 3. 负载均衡 (Load Balancing)

NGINX 支持多种负载均衡算法，通过 `upstream` 块配置：

```nginx
# 加权轮询 (默认)
upstream users_upstream {
    server localhost:3001 weight=5;
    server localhost:3004 weight=2;  # 灰度: 20% 流量
}

# 一致性哈希（用于 session 亲和性）
upstream users_sticky {
    hash $remote_addr consistent;
    server localhost:3001;
    server localhost:3004;
}

# IP 哈希
upstream orders_ip_hash {
    ip_hash;
    server localhost:3002;
    server localhost:3005;
}
```

### 4. 限流 (Rate Limiting)

NGINX 原生支持限流：

```nginx
# 1. 定义限流区域（nginx.conf 中）
limit_req_zone $binary_remote_addr zone=global_limit:10m rate=60r/m;

# 2. 应用限流（location 中）
location /api/users/ {
    limit_req zone=global_limit burst=20 nodelay;
}
```

- `rate=60r/m` — 每分钟 60 个请求
- `burst=20` — 允许突发 20 个请求（积压排队）
- `nodelay` — 突发请求不延迟处理

超限的请求返回 `429 Too Many Requests`。

### 5. 熔断 / 故障转移 (Circuit Breaker)

NGINX 原生支持熔断机制：

```nginx
# upstream 中：
server localhost:3001 max_fails=3 fail_timeout=30s;

# location 中：
proxy_next_upstream error timeout http_502 http_504;
proxy_next_upstream_tries 3;
```

**工作流程：**

```
请求失败 → 失败计数 +1
连续失败 3 次 (max_fails=3) → 标记为不可用
30 秒内 (fail_timeout=30s)  不再发送请求
30 秒后 → 自动恢复，尝试发请求
恢复成功 → 继续使用
恢复失败 → 重新熔断
```

### 6. 健康检查 (Health Checks)

NGINX 有两种健康检查：

**被动健康检查（开源版）** — 通过请求的成败来推断：

```nginx
server localhost:3001 max_fails=3 fail_timeout=30s;
```

**主动健康检查（NGINX Plus）** — 定期主动探测：

```nginx
# 需要 NGINX Plus 订阅
health_check interval=5s fails=3 passes=2 uri=/health;
```

### 7. 转发头 (Forwarded Headers)

NGINX 添加标准转发头，让上游服务知道客户端的真实 IP：

```nginx
proxy_set_header  Host               $host;
proxy_set_header  X-Real-IP          $remote_addr;
proxy_set_header  X-Forwarded-For    $proxy_add_x_forwarded_for;
proxy_set_header  X-Forwarded-Proto  $scheme;
```

- `X-Real-IP` — 客户端真实 IP
- `X-Forwarded-For` — 经过的所有代理 IP 链
- `X-Forwarded-Proto` — 原始协议（http/https）

### 8. WebSocket 代理

WebSocket 是长连接协议，需要通过 HTTP Upgrade 机制从 HTTP 升级为 WebSocket。
NGINX 代理 WebSocket 时需要额外配置：

```nginx
upstream chat_upstream {
    server localhost:3004 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

location /ws/chat/ {
    proxy_pass http://chat_upstream/ws/chat/;
    proxy_http_version 1.1;                     # WebSocket 需要 HTTP/1.1
    proxy_set_header Upgrade \$http_upgrade;     # 传递 Upgrade 头
    proxy_set_header Connection "upgrade";      # 标记为升级连接
    proxy_read_timeout 3600s;                   # 长连接超时 (1h)
    proxy_buffering off;                        # 不能缓冲
    proxy_cache off;                             # 不能缓存
}

# HTTP 端点 (Socket.IO 先用 HTTP 握手)
location /chat/ {
    proxy_pass http://chat_upstream/chat/;
}
```

**关键点：**

- `proxy_http_version 1.1` — WebSocket 要求 HTTP/1.1（默认是 1.0）
- `Upgrade` + `Connection` — 告诉上游这次连接要升级为 WebSocket
- `proxy_read_timeout` — 设为长时间（默认 60s 会断开 WebSocket）
- `proxy_buffering off` — WebSocket 是全双工的，不能缓冲
- `proxy_cache off` — WebSocket 没有缓存概念

测试方式：

```bash
# CLI 聊天客户端
node demo/chat-client.js 用户名 房间名

# 浏览器聊天页面
# http://localhost:8080/chat.html
```

---

## 请求处理全流程

```
Step 0: 启动
        nginx 读取 nginx.conf
        → include sites/*.conf 加载 upstreams.conf + gateway.conf
        → worker_processes 启动工作进程
        → 监听 :8080

Step 1: 客户端请求
        curl http://localhost:8080/api/users/1

Step 2: NGINX 限流检查
        limit_req zone=global_limit burst=20 nodelay
        → 检查 IP 是否超限
        → 超限则立即返回 429，不继续处理

Step 3: 匹配 location
        请求路径 /api/users/1
        → 匹配 location /api/users/ { proxy_pass http://users_upstream/; }

Step 4: 路径重写 (strip_path)
        原路径: /api/users/1
        proxy_pass 末尾有 / → 去掉 /api/users 前缀
        上游路径: /1

Step 5: 负载均衡 + 健康检查
        从 users_upstream 中选择 target
        → 选择 localhost:3001 (仅选健康的)
        → 如果 3001 不健康，尝试下一个

Step 6: 添加转发头
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for
        proxy_set_header X-Real-IP $remote_addr
        ...

Step 7: 转发到上游
        NGINX 向 http://localhost:3001/1 发送 HTTP 请求
        → 带上 Step 6 的头

Step 8: 接收上游响应
        ← 200 OK
        ← {"service":"users-service","data":{"id":1,"name":"Alice"}}

Step 9: 错误处理 (如果上游失败)
        如果 3001 连接失败:
        → proxy_next_upstream 尝试下一个目标
        → 全部失败返回 502 Bad Gateway
        → upstream max_fails=3 标记该 target 为不可用

Step 10: 返回给客户端
        记录访问日志
        ← 200 {"service":"users-service","data":{...}}
```

---

## 项目结构

```
nginx-gateway-lab/
│
├── package.json                  # 启动脚本
├── Procfile                      # overmind 进程管理
├── README.md                     # 本文件
│
├── nginx/                        # NGINX 配置（完全本项目独立）
│   ├── nginx.conf                # NGINX 主配置
│   ├── logs/                     # 运行时日志 (自动生成)
│   ├── nginx.pid                 # 进程 PID (自动生成)
│   │
│   ├── sites/                    # 站点配置
│   │   ├── upstreams.conf        # 上游服务定义
│   │   ├── gateway.conf          # 网关路由
│   │   └── advanced.conf         # 进阶配置（灰度/哈希/Plus）
│   │
│   └── snippets/                 # 可复用配置片段
│       └── reference.conf        # CORS/安全头/缓存/限流片段
│
├── services/                     # 上游服务（模拟微服务）
│   ├── users-service/index.js    # :3001 - 用户服务
│   ├── orders-service/index.js   # :3002 - 订单服务
│   ├── products-service/index.js # :3003 - 商品服务
│   └── chat-service/index.js     # :3004 - 聊天服务(WebSocket)
│
├── logs/                         # 运行时日志
18G├── demo/
   ├── run-demo.sh               # 自动化演示脚本
   ├── chat-client.js            # CLI 聊天客户端
   └── public/chat.html          # 浏览器聊天页面
```

---

## 进阶学习路线

### 1. 修改限流规则，理解限流原理

```bash
# 把限流调到 10r/m，测试触发 429
# 编辑 nginx/nginx.conf，改 rate=10r/m
# 然后 nginx -c $(PWD)/nginx/nginx.conf -p $(PWD) -s reload
# 再用循环测试
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "req $i: %{http_code}\n" http://localhost:8080/api/products
done
```

### 2. 模拟上游宕机，观察 NGINX 容错

```bash
# 停掉 users-service
kill $(lsof -ti:3001)

# 连续请求，观察 502 → 503 的过程
# 第 1-3 次: 502 (NGINX 还在重试)
# 第 4 次开始: 503 (upstream 被标记为不可用)
curl -w "\nHTTP: %{http_code}\n" http://localhost:8080/api/users

# 重启服务后，30s 后自动恢复
```

### 3. 添加灰度发布

```nginx
# 编辑 upstreams.conf
upstream users_upstream {
    server localhost:3001 weight=8;   # v1: 80%
    # server localhost:3004 weight=2; # v2: 20% (起一个新实例在 3004)
}
```

### 4. 添加自定义响应头

```nginx
# gateway.conf 的 location 中添加
add_header X-Gateway-Version "1.0";
```

### 5. WebSocket 聊天测试

开两个终端跑聊天客户端，验证 WebSocket 代理：

```bash
# 终端 1
node demo/chat-client.js Alice general

# 终端 2
node demo/chat-client.js Bob general

# 或浏览器打开 http://localhost:8080/chat.html
```

### 6. 推荐阅读

- [NGINX 官方文档 — ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [NGINX 限流配置详解](https://www.nginx.com/blog/rate-limiting-nginx/)

---

## 许可证

MIT — 学习用途，欢迎 Fork 和提 PR！
