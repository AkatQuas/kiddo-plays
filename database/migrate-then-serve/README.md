# migrate-then-serve

一个最小可运行的示例：**一次发版同时交出 schema 变更和业务服务，但二者不在同一个进程里执行。**

发版单位是「这一版的 SQL + 这一版的 service」。编排保证：**先把 migration 跑完，再切换到新服务**。服务进程只服务请求，不执行 DDL。

---

## 要解决什么

很多应用在进程启动时跑 migration（listen 之前 `migrate()`）。看起来简单，失败模式却和业务混在一起：

- schema 失败表现为 API CrashLoop，很难和代码 bug 区分
- 多副本会抢着跑 DDL
- 回滚镜像时，库结构已经变了，旧进程带着新 schema 启动
- 「服务起来了」并不等于「这一版该有的表结构已经到位」

本示例把这两件事拆开，但**仍然绑在同一次发布里**：

| | 同一次发布必须包含 | 运行时谁来做 |
|---|---|---|
| schema | 本版 `migrations/*.sql` | 一次性 `migrate` 任务 |
| service | 本版 API 镜像 / 配置 | 长期运行的 `api` |

不是「先发一版只改库、再发一版改服务」，也不是「服务自己改库」。  
是：**一个版本、一次 rollout、两步顺序执行。**

```text
本版产物
  ├── migrator 镜像（内含本版 SQL）
  └── api 镜像（本版业务，禁止 DDL）

本版 rollout
  db healthy  →  migrate 跑完并 exit 0  →  新 api 才允许启动
```

---

## 思想：分离进程，同步发版

**分离**指生命周期，不是指发版节奏。

```text
         ┌─────────┐
         │   db    │  数据持久化；不随发版重建
         └────┬────┘
              │ healthy
              ▼
         ┌─────────┐
         │ migrate │  一次性任务：apply 尚未记录的 SQL → exit 0
         └────┬────┘
              │ completed successfully
              ▼
         ┌─────────┐
         │   api   │  长期服务：读库、对外提供 HTTP，不执行 DDL
         └─────────┘
```

因此：

1. **失败边界清楚。** migration 失败时 API 根本不会起来；不会用业务进程的重启去「重试 DDL」。
2. **新服务只面对本版 schema。** `depends_on: migrate` + `service_completed_successfully` 保证：用户打到的新进程，库已经是本版 SQL 应用后的状态。
3. **旧库上的重复发布是安全的。** migrator 用 `schema_migrations` 做账本，已应用的 version 跳过；工具可以反复生成新文件，apply 本身幂等。
4. **服务被禁止偷跑 DDL。** API 未设置 `SKIP_STARTUP_MIGRATE=1` 会直接 exit 1，避免「分离」只写在文档里。

Compose 里的 `migrate` 对应 Kubernetes 的 **initContainer** 或发版流水线里的 **Job**：和 Deployment 同一次发布，先于业务容器完成。

```yaml
# 同一份 release：同一 tag 的 migrator + api
initContainers:
  - name: schema-migrate
    image: myapp-migrator:1.4.0
    command: ["node", "migrate.mjs"]
containers:
  - name: api
    image: myapp-api:1.4.0
    env:
      - name: SKIP_STARTUP_MIGRATE
        value: "1"
```

---

## 一次本地「发版」长什么样

本仓库用 Docker Compose 模拟上述 rollout。数据库卷保留；每次发布只重建 **migrate** 和 **api**。

```bash
cd migrate-then-serve

# 冷启动：基线 SQL（001 + 002）+ 基线 API
docker compose up --build -d
curl -s http://127.0.0.1:18080/readyz
curl -s http://127.0.0.1:18080/api/schema
```

之后每一次「发新版」= **写入本版 SQL → 重建 migrator/api → 验证库上已是本版结构**：

```bash
# 生成一条新 migration（列 + 行），compose up，对照 /api/schema
npm run up
```

`npm run up` 等价于：

1. 生成 `migrator/migrations/NNN_*.sql` 和期望快照 `.migration-gen/last.json`
2. `docker compose up --build --force-recreate migrate api -d`  
   （db 不重建，账本和数据留在 volume 上；migrator 只 apply 尚未记录的文件）
3. `GET /api/schema`：账本里出现本版 version，且列/行符合期望；同时复验基线未被破坏

连续执行两次 `npm run up`，就是连续两次发版：库结构叠加，而不是覆盖。

端到端把「reset → 基线发布 → 三种 schema 变更各发一版」跑完：

```bash
npm run verify-flow
```

通过会打印 `[flow] ALL PASSED`。

---

## 前置

本机 Docker，镜像已存在即可（默认不 pull）：

- `postgres:16-alpine`
- `node:22-alpine`

| 服务 | 地址 |
|---|---|
| API | http://127.0.0.1:18080 |
| Postgres | `postgres://app:app@127.0.0.1:55433/app` |

---

## 命令

| 命令 | 作用 |
|---|---|
| `npm run up` | 生成一条 migration + 同步发版（重建 migrate/api）+ 验证 |
| `npm run do-migration` | 只生成 SQL（`auto` / `add-column` / `insert-item`） |
| `npm run verify` | 对照 `last.json` 检查正在跑的 `/api/schema` |
| `npm run verify-flow` | reset 后连续发基线 + 三版变更 |
| `npm run reset` | `compose down -v`，删掉生成的 SQL，回到 001/002 |

只生成、自己看日志时：

```bash
node scripts/do-migration.mjs              # 默认 auto：新列 + 新行
node scripts/do-migration.mjs add-column priority text
node scripts/do-migration.mjs insert-item "batch-42"

docker compose up --build --force-recreate migrate api -d
npm run verify
```

生成出的 `NNN_*.sql` 不入库（gitignore）；基线 `001_init.sql`、`002_add_status.sql` 始终跟踪。`reset` 会清掉生成文件。

验证看的是**库上的效果**，不是 SQL 原文：账本 version、`items` 列名、行内容。每次都会先确认 `001`/`002`、`status` 列、`alpha`/`beta` 仍在。

```bash
curl -s http://127.0.0.1:18080/api/schema | jq .
docker compose logs migrate
docker compose logs api
```

---

## API

| 路径 | 说明 |
|---|---|
| `GET /healthz` | 进程活着 |
| `GET /readyz` | ledger 与基础表已存在（编排用） |
| `GET /api/schema` | 本版验证：migrations、列、行 |
| `GET /api/items` | items 列表 |

---

## 布局

```text
migrate-then-serve/
├── docker-compose.yml           # db → migrate(exit 0) → api
├── migrator/                    # 发布期任务：只做 schema
│   ├── migrate.mjs              # advisory lock + schema_migrations
│   └── migrations/              # 本版 SQL；001/002 为基线
├── api/                         # 运行期服务：禁止 DDL
└── scripts/                     # 本地模拟「写本版 SQL + 发版 + 验收」
    ├── do-migration.mjs
    ├── verify-flow.mjs
    └── reset.mjs
```

环境变量：`DATABASE_URL`（migrator / api）、`SKIP_STARTUP_MIGRATE=1`（api 必填）、`MIGRATE_THEN_SERVE_API`（verify 默认 `http://127.0.0.1:18080`）。

---

## 清理

```bash
npm run reset
```
