# PG 实战营 (Postgres Playground)

交互式 PostgreSQL 学习平台 —— 在真实数据库环境中编写和运行 SQL，实时观察执行结果和性能指标。

## 快速启动

### 开发环境

```bash
cp .env.example .env
make install
make dev
```

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001
- PostgreSQL: localhost:5432

### 生产环境 (Docker)

```bash
cp .env.example .env
make build
make up
```

访问 http://localhost:8080

## 功能特性

- **16 章系统化课程**：基础篇 → 中级篇 → 高级篇 → 迁移篇 → 性能优化篇
- **Monaco SQL 编辑器**：语法高亮、自动补全、快捷键执行
- **填空模式**：`{{变量}}` 占位符交互练习
- **执行计划可视化**：EXPLAIN ANALYZE 树形展示 + 优化建议
- **事务管理**：DML 自动事务 + 手动提交/回滚
- **章节数据隔离**：每章独立 Schema + Savepoint 快速重置
- **迁移管理**：Up/Down 脚本 + 迁移历史
- **锁等待图**：高级章节实时锁状态可视化

## 项目结构

```
pg-playground/
├── server/          # NestJS 后端
├── web/             # React 前端
├── docker/          # PostgreSQL 初始化脚本
├── docker-compose.yml
└── Makefile
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `make install` | 安装依赖 |
| `make dev` | 开发模式启动 |
| `make build` | 构建 Docker 镜像 |
| `make up` | 启动生产容器 |
| `make down` | 停止容器 |
| `make db-shell` | 进入 psql |
| `make db-reset` | 重置数据库 |
| `make test` | 运行后端测试 |
| `make lint` | 代码检查 |

## 添加新章节

1. 在 `server/data/chapters.json` 添加章节元数据
2. 创建 `server/data/chapter_{id}/config.json` 配置文件
3. 创建 `server/data/chapter_{id}/init.sql` 初始化脚本
4. 重启后端服务

## API 端点

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/chapters` | GET | 章节目录 |
| `/api/chapters/:id` | GET | 章节详情 |
| `/api/query/execute` | POST | 执行 SQL |
| `/api/query/commit` | POST | 提交事务 |
| `/api/query/rollback` | POST | 回滚事务 |
| `/api/session/reset` | POST | 重置章节数据 |
| `/api/migration/up` | POST | 执行迁移 |
| `/api/migration/down` | POST | 回滚迁移 |
| `/api/migration/history` | GET | 迁移历史 |
| `/api/schema/status` | GET | Schema 状态 |

## 技术栈

- 前端: React 19, Ant Design, Monaco Editor, ECharts, Tailwind CSS
- 后端: NestJS 10, node-postgres
- 数据库: PostgreSQL 18
- 容器: Docker + Docker Compose
