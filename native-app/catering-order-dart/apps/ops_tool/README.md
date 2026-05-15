# ops_tool

餐饮系统运维工具，包含 Web 管理界面和服务端。

## 目录结构

```
ops_tool/
├── web/      # Flutter Web 管理界面
└── server/   # Dart 服务端
```

## 开发

### Web

```bash
cd web
flutter run
```

### Server

```bash
cd server
dart run lib/main.dart
```

## 部署

### 构建

```bash
# 构建 Web
flutter build web -o output/web

# 构建 Server
cd server
dart compile exe lib/main.dart -o ../output/ops_server
```

### 部署结构

部署时需要将以下文件放在一起：

```
ops_server/          # 部署目录
├── ops_server       # 可执行文件
├── ops_tool.db      # SQLite 数据库（自动创建）
└── web/             # Web 静态文件（从 output/web 复制）
    ├── index.html
    ├── main.dart.js
    └── ...
```

## API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET/POST | `/api/stores` | 门店台账 |
| GET/PUT/DELETE | `/api/stores/:id` | 门店详情 |
| GET/POST | `/api/versions` | 版本管理 |
| GET/POST | `/api/issues` | 故障记录 |
| PUT | `/api/issues/:id` | 更新故障 |
| GET/POST | `/api/artifacts` | 产物管理 |
| GET | `/health` | 健康检查 |

服务运行在 http://localhost:8080