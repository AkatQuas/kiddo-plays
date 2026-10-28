# imgrelay

[English](README.md)

多 Pod 的图生图作业调度器。本进程不加载模型：它把作业放进共享队列，调用 Pod 外面的图生图 HTTP 引擎，再把结果图片放到 S3，或写到本 Pod 的目录里。

适合：

- 若干副本一起消费同一条队列，后面接一个已经存在的图生图服务
- 需要失败重试、过期认领回收、提交后轮询结果
- 对象存储用 S3 兼容接口（AWS、MinIO、Cloudflare R2 等）

不适合：

- 在这个进程里跑扩散模型
- 单机内存队列。队列只有 Redis 一种实现
- 多 Pod 同时把结果写在各自的本地盘上。本地目录只在 `STORAGE_BACKEND = "local"` 且只有一个 Pod 时有意义

## 模块

| 模块 | 对外只需要知道 | 实现藏起来的东西 |
| --- | --- | --- |
| JobBoard | 提交、查询、认领、确认、重试、失败 | Redis 列表、租约、过期回收 |
| Scheduler | 处理一条已认领的作业，或启动本 Pod 的工作线程 | 重试上限、并发、引擎和存储的调用顺序 |
| ImageEngine | 把一条作业变成图片字节 | HTTP 路径、超时、状态码 |
| ObjectStore | 写入字节，返回结果引用 | S3 预签名，或 Pod 内文件路径 |

词汇表见 [GLOSSARY.md](GLOSSARY.md)。

一条作业的路径：

```
POST /v1/jobs
  → JobBoard.submit（Redis，先来先服务）
任一 Pod 的 Scheduler
  → claim
  → POST {ENGINE_BASE_URL}/v1/images/edits
  → ObjectStore.put
  → ack / retry / fail
GET /v1/jobs/{id}
  → 任意 Pod 都能读到 status 和 result_ref
```

认领后若工作进程消失，超过可见性窗口的作业会回到队尾。尝试次数达到 `MAX_ATTEMPTS` 后标记为失败。重试的作业排到队尾，不插队。

## 常量与环境变量

策略写在 [`src/imgrelay/constants.py`](src/imgrelay/constants.py)，改行为就改这个文件，然后重新构建镜像。包括监听端口、存储后端、并发、重试次数、HTTP 超时、预签名有效期、默认步数。

环境变量只描述本 Pod 以外的服务：

| 变量 | 何时需要 |
| --- | --- |
| `REDIS_URL` | 总是 |
| `ENGINE_BASE_URL` | 总是，例如 `http://engine:8081` |
| `S3_ENDPOINT_URL` | `STORAGE_BACKEND == "s3"` |
| `S3_BUCKET` | 同上 |
| `S3_ACCESS_KEY_ID` | 同上 |
| `S3_SECRET_ACCESS_KEY` | 同上 |
| `S3_REGION` | 可选，默认 `us-east-1` |

把结果留在本 Pod 时，把 `STORAGE_BACKEND` 改成 `"local"`。文件在 `LOCAL_OUTPUT_DIR`。`result_ref` 是该 Pod 上的绝对路径，其他 Pod 读不到。

## 引擎契约

`HttpImageEngine` 向 `{ENGINE_BASE_URL}/v1/images/edits` 发送 JSON：

```json
{
  "prompt": "forest",
  "negative_prompt": "",
  "input_image": "https://example.com/in.png",
  "width": null,
  "height": null,
  "steps": 40,
  "cfg_scale": 7.5,
  "seed": null
}
```

成功时返回 HTTP 200，`Content-Type` 为 `image/png`、`image/jpeg` 或 `image/webp`，正文是图片字节。4xx/5xx 或空正文算一次失败。

`input_image` 必须是引擎自己能够下载的 http(s) URL。调度器不代下原图，也不接收本地上传。

`examples/mock_engine.py` 是一个返回 1×1 PNG 的替身，只用于把调度链路跑通。

## API

`POST /v1/jobs`

```json
{
  "prompt": "replace the background with a forest",
  "input_image": "https://example.com/in.jpg",
  "steps": 40
}
```

返回 `job_id` 和 `status: waiting`。

`GET /v1/jobs/{job_id}`

`status` 为 `waiting`、`running`、`finished` 或 `failed`。成功时 `result_ref` 是预签名 URL 或本地路径。失败时看 `error`。

`GET /v1/health` 检查本进程能否 ping 通 Redis。

## 运行

本地测试不需要 Redis：

```bash
pip install -e ".[dev]"
pytest
```

在 `deploy/` 下用 Docker Compose 拉起 Redis、MinIO、替身引擎和调度器：

```bash
docker compose up --build
```

Compose 使用 MinIO 公布的本地默认账号（`minioadmin` / `minioadmin`），只用于这条本地栈。

提交一条作业：

```bash
curl -s localhost:8000/v1/jobs \
  -H 'content-type: application/json' \
  -d '{"prompt":"forest","input_image":"https://example.com/in.png"}'
```

再用返回的 `job_id` 轮询 `GET /v1/jobs/{job_id}`。MinIO 的桶会在首次启动时按 `S3_CREATE_BUCKET` 创建。

多副本时每个 Pod 使用同一组 `REDIS_URL`、`ENGINE_BASE_URL` 和 S3 变量，并保持 `STORAGE_BACKEND = "s3"`。各 Pod 独立认领，互不共享内存。

## 许可

MIT，见 [LICENSE](LICENSE)。
