# clip-embed

基于 [CLIP](https://huggingface.co/openai/clip-vit-large-patch14) 的图像向量嵌入 API 服务。上传图片，返回 L2 归一化后的 768 维 embedding 向量，可用于以图搜图、相似度计算等场景。

## 功能

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `POST /image-embedding/` | 单张图片 embedding |
| `POST /batch-image-embeddings/` | 上传 ZIP 批量处理 |
| `POST /gallery/images/` | 将图片加入可检索图库 |
| `POST /gallery/images/batch/` | ZIP 批量入库 |
| `GET /gallery/images/` | 列出图库中的图片 |
| `DELETE /gallery/images/{id}` | 从图库删除图片 |
| `POST /image-search/` | 以图搜图（Top-K 相似结果） |

交互式文档：http://localhost:11204/docs

## 快速开始（Docker，推荐）

### 1. 准备模型

将 CLIP 模型放到 `models/clip-vit-large-patch14/`，至少包含：

```
models/clip-vit-large-patch14/
├── model.safetensors      # ~1.7 GB
├── config.json
└── preprocessor_config.json
```

也可通过 CLI 下载（见下方「下载模型」）。

### 2. 启动服务

```bash
cd clip-embed
docker compose up --build -d
```

### 3. 测试

```bash
bash scripts/test_api.sh
```

### 4. 停止

```bash
docker compose down
```

## 下载模型

仅下载推理所需文件（约 1.7 GB，不含 Flax/TF/PyTorch 重复权重）：

```bash
export HF_ENDPOINT=https://hf-mirror.com
export HF_HUB_DISABLE_XET=1
uv run clip-embed download-model
```

国内用户使用 `HF_ENDPOINT` 镜像时，`download-model` 会自动设置 `HF_HUB_DISABLE_XET=1`。

## 本地开发

### 环境要求

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)

> pyenv 安装的 Python 需包含 `_lzma` 模块（`python -c "import lzma"` 无报错）。缺失时见下方常见问题。

### 安装与启动

```bash
cd clip-embed
cp .env.example .env   # 可选
uv sync
uv run clip-embed serve
```

## API 示例

```bash
# 健康检查
curl http://localhost:11204/health

# 单张图片
curl -X POST http://localhost:11204/image-embedding/ \
  -F "file=@example.jpg"

# 批量处理
curl -X POST http://localhost:11204/batch-image-embeddings/ \
  -F "file=@images.zip"
```

### 以图搜图

```bash
# 1. 单张入库
curl -X POST http://localhost:11204/gallery/images/ \
  -F "file=@photo-a.jpg" \
  -F "image_id=photo-a" \
  -F 'metadata={"category":"product"}'

# 或 ZIP 批量入库（image_id 由 ZIP 内相对路径生成，如 a/photo.jpg → a_photo）
curl -X POST http://localhost:11204/gallery/images/batch/ \
  -F "file=@images.zip" \
  -F 'metadata={"source":"catalog"}'

# 2. 用查询图搜索 Top-K 相似图片（相似度为余弦，范围约 0–1）
curl -X POST "http://localhost:11204/image-search/?top_k=5" \
  -F "file=@query.jpg"
```

图库索引默认持久化到 `data/gallery/`（`index.json` + `embeddings.npz`）。

首次 embedding 请求会懒加载模型，CPU 上可能需要 1–2 分钟。

## Docker 镜像

| 文件                 | 说明                                                            |
| -------------------- | --------------------------------------------------------------- |
| `Dockerfile.cpu`     | CPU 镜像，`python:3.12-slim` + CPU PyTorch（不拉 nvidia-\* 包） |
| `Dockerfile.gpu`     | GPU 镜像，`pytorch/pytorch` CUDA runtime                        |
| `docker-compose.yml` | CPU 部署，挂载 `./models`                                       |

### CPU 手动构建

```bash
docker build -f Dockerfile.cpu -t clip-embed:cpu .
docker run -p 11204:11204 -v $(pwd)/models:/app/models clip-embed:cpu
```

### GPU 手动构建

```bash
docker build -f Dockerfile.gpu -t clip-embed:gpu .
docker run --gpus all -p 11204:11204 \
  -v $(pwd)/models:/app/models clip-embed:gpu
```

构建参数：

| 参数                  | 默认值                    | 说明                         |
| --------------------- | ------------------------- | ---------------------------- |
| `UV_INDEX_URL`        | `https://pypi.org/simple` | PyPI 源                      |
| `HF_ENDPOINT`         | `https://hf-mirror.com`   | HF 镜像（模型下载）          |
| `SKIP_MODEL_DOWNLOAD` | `1`                       | `0` 时在镜像构建阶段下载模型 |

## 配置

| 环境变量             | 默认值                          | 说明                                                |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| `HF_ENDPOINT`        | —                               | Hugging Face 镜像，国内推荐 `https://hf-mirror.com` |
| `HF_HUB_DISABLE_XET` | —                               | 使用镜像时建议 `1`                                  |
| `MODEL_ID`           | `openai/clip-vit-large-patch14` | 模型 ID                                             |
| `MODEL_PATH`         | `models/clip-vit-large-patch14` | 本地模型路径                                        |
| `GALLERY_PATH`       | `data/gallery`                  | 图库索引存储路径                                    |
| `HOST`               | `0.0.0.0`                       | 监听地址                                            |
| `PORT`               | `11204`                         | 监听端口                                            |

## 项目结构

```
clip-embed/
├── src/clip_embed/
│   ├── main.py           # FastAPI 入口
│   ├── config.py         # 配置
│   ├── download.py       # 模型下载
│   ├── gallery.py        # 图库索引与检索
│   ├── model.py          # 推理
│   ├── cli.py            # CLI
│   └── routes/
│       ├── embedding.py  # embedding API
│       └── search.py     # 以图搜图 API
├── scripts/
│   └── test_api.sh       # 端到端测试
├── tests/
├── Dockerfile.cpu
├── Dockerfile.gpu
├── docker-compose.yml
└── pyproject.toml
```

## 开发

```bash
uv sync --group dev
uv run pytest
```

## 常见问题

### `401 Unauthorized` from `cas-server.xethub.hf.co`

大文件走 XET 协议，镜像站无法代理。设置 `HF_HUB_DISABLE_XET=1`（使用 `HF_ENDPOINT` 镜像时自动开启）。

### `ModuleNotFoundError: No module named '_lzma'`

pyenv Python 编译时缺少 `xz` 库。修复：

```bash
brew install xz
pyenv uninstall 3.12.13 && pyenv install 3.12.13
cd clip-embed && rm -rf .venv && uv sync
```

或直接使用 Docker 部署，不依赖本机 Python 环境。
