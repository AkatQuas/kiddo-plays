# 用「控制面 + 资源控制器 + 网关」拆一个聊天系统

> **控制面只管"房间"这个资源如何建立、如何发入场券；资源控制器（房间服务）只负责"人进来之后，同一间房里的话怎么传"；网关把两端合成一个统一入口。** 控制面与房间服务之间需要对齐的数据——有哪些房间、token 还有没有效、谁在线——都放在 **Redis** 里作为唯一的共享真相源。

一个**可运行**的 Proof-of-Concept，用来白盒验证「**控制面 + 资源控制器**」这套拆分到底怎么跑起来。

## 角色分工

| 角色          | 端口   | 属于       | 管什么                                         |
| ------------- | ------ | ---------- | ---------------------------------------------- |
| **Redis**     | `6379` | 共享状态层 | 房间注册表、token 有效期、在线人数（两端对齐） |
| **Kong 网关** | `8000` | 统一入口   | 按路径把请求路由到对应后端                     |
| **控制面**    | `3030` | 控制面     | 建/删房间、签发短时效 token（写 Redis）        |
| **房间服务**  | `8080` | 资源控制器 | 认 token（读 Redis）、同房广播、回写在线       |

```
浏览器 / Node 客户端
   │
   │ ① POST /api/rooms ──────────────── ② socket.io(带 token) 连入
   ▼                                       │
┌───────────── Kong :8000 ──────────────────────────────┐
│  /api*        →  控制面     :3030                      │
│  /socket.io*  →  房间服务   :8080（含 WebSocket 升级）   │
└──────────────────┬────────────────────────────────────┘
            同一个共享真相 → Redis:6379
       ┌──────────────┴────────────────┐
   控制面写：                      房间控制器读/写：
 token:{token} -> roomId(PX)   校验 token、登记在线
 room:{roomId}  -> name        presence:{roomId} 在线集合
```

## 核心思想

### 1. 控制面 与 资源控制器 分离

- **控制面管理"资源"（房间）**：建、删、签发 token。它从不进入聊天流量路径，也不知道某条消息发给了谁。
- **房间控制器（房间服务）真正为一间房干活**：校验、广播。它不知道这扇门的"入场资格由谁发"——只认控制面写在 Redis 里的 token。
- 收益：**独立扩缩**（聊天流量大 → 房间服务自己水平加实例）、**故障隔离**（某间房出问题不会拖垮其它）、**安全上收**（吊销进出都集中在控制面一处）。

### 2. 入场券（token）的存亡同步 = Redis 的 TTL

- 控制面建房时把 `token:{opaque} → roomId` 写进 Redis，并设 **TTL = token 有效（默认 1 分钟）**。
- 房间服务在连接前 `GET token:<t>`：
  - 取不到（=不存在 / **Redis 已按 TTL 删除** = 过期 / 被控制面 `DEL` 吊销）→ 拒接 `connect_error`。
- **"1 分钟内没用起来就秒拒"靠的是 Redis 键自己到期**——token 的过期不该客户端算、不靠房间反复检查，过期即清零、全网立即失效。

### 3. 网关只路由，不审内容

- Kong 只按 path 转发 `/api`、`/socket.io`（含 ws 升级），它看不到聊天内容；真正的准入在房间控制器（结合 Redis）。

## 目录结构

```
poc-chat-control/
├─ README.md                      本说明
├─ docker-compose.yml             Redis + 控制面 + 房间服务 + Kong
├─ kong/kong.yml                  Kong 声明式路由
├─ shared/
│  └─ redis.mjs                   node-redis 客户端（控制面&房间服务共用）
├─ control-plane/                 控制面 :3030
│  ├─ Dockerfile                 (node:24-alpine)
│  └─ src/index.mjs               建/列/删房间 + 签发 token（写 Redis）
├─ room-service/                   房间服务(资源控制器) :8080
│  ├─ Dockerfile                 (node:24-alpine)
│  ├─ static/index.html          浏览器 UI
│  └─ src/index.js               socket.io：读 Redis 校验 token、广播、写在线
└─ client/
   ├─ package.json               (socket.io-client)
   └─ demo.mjs                   命令行验证
```

## 运行

### 方式A — 全 Docker

> 需要 Docker compose 运行。镜像：`redis:7-alpine`、`kong:3.9`、`node:24-alpine`。

```bash
docker compose up --build

# 客户端走网关（控制面/房间都经 Kong :8000）跑一键验证
cd client && CONTROL=http://localhost:8000 GW=http://localhost:8000 node demo.mjs
```

起来后：Redis `:6379`（调试可直连）、网关 `:8000`、房间 `:8080`（直连调试）、控制面只暴露给网关。

> 若首次 `curl :8000/api/...` 返回 **503 name resolution failed**：通常是 Kong 在后端还没就绪时把服务名 DNS 裁决成“未找到”并缓存了。后端其实已就绪（`docker compose exec gateway getent hosts control-plane` 能解析出来），只需 `docker compose restart gateway` 清掉该缓存即可。

### 方式B：纯 Node

> 用一个 docker-compose 里的 **redis** service 当共享状态（其余业务进程仍在本机跑，便于观察/调试）。

```bash
# 0) 用 docker-compose 只把 redis 服务拉起来，向本机暴露 6379
docker compose up -d redis
# 1) 装依赖（仓库根、控制面、房间、client 各一次）
npm i && (cd control-plane && npm i) && (cd room-service && npm i) && (cd client && npm i)

# 2) 终端 1：控制面
(cd control-plane && node src/index.mjs)          # :3030
# 3) 终端 2：房间服务
(cd room-service && node src/index.mjs)           # :8080
# 4) 终端 3：验证
(cd client && node demo.mjs)                      # 默认 CONTROL=:3030、GW=:8080

# 用完可只停掉 redis（其它服务不动）
docker compose stop redis
```

浏览器 UI：开 `http://localhost:8080`，两个标签页用不同昵称互聊。

## 验证（demo.mjs 打印）

```bash
① 控制面建房: room-xxx · token(exp≈ 700 ms)
② alice/bob 都进入同一房间（入口 :8080）
③ alice 的消息被 bob 收到: ...
④ 过期 token 连接被拒: token 无效/已过期 → 符合"过期即拒"
```

「控制面 ↔ 房间 对齐」演示：

```bash
POST 房间 → carol 连上 → GET /api/rooms => 该房间 online = 1（是房间写进 Redis、控制面读到的）
```

## 每层的验证点

- **对齐**：房间 / token 都在 Redis，控制面只 `set`，房间服务只 `get` + 回写在线——两边看到的是同一真相。
- **凭证即入口**：token 不存在 / 过期（Redis TTL 到期）→ 连接直接拒，不重复信任客户端（以 Redis 为准）。
- **网关只管路由**：只转发字节。

## 后续可扩展（预留插槽）

- 房间服务多实例 + `@socket.io/redis-adapter`，跨实例广播（在线已对齐，扩实例后也看到一致的数据）。
- 控制面持久化 + 细化鉴权（角色 / 配额），吊销名单放 Redis。
- 房间 TTL 设成 > token TTL，支持"过期后重新签发"、"热切换 token"等。
