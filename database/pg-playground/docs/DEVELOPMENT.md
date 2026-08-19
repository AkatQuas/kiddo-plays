# 开发指南

## 添加新章节

1. 在 `server/data/chapters.json` 添加章节元数据：

```json
{ "id": "ch_17_new_topic", "title": "新主题", "category": "中级篇", "order": 17 }
```

2. 创建目录 `server/data/chapter_ch_17_new_topic/`

3. 编写 `config.json`（参考 `chapter_ch_01_basic_select/config.json`）

4. 编写 `init.sql`（建表 + 初始数据，建议幂等）

5. 重启后端服务

## 章节 Schema 隔离

每个章节自动创建 Schema `chapter_{id}`，通过 `SET search_path` 隔离数据。

## 本地开发

```bash
make install
make dev
```

前端 http://localhost:5173，API http://localhost:3001

## 运行测试

```bash
make test    # 后端单元测试
make lint    # ESLint
```

## API 调试

```bash
curl http://localhost:3001/api/chapters
curl -X POST http://localhost:3001/api/query/execute \
  -H 'Content-Type: application/json' \
  -d '{"chapterId":"ch_01_basic_select","sql":"SELECT 1;"}'
```
