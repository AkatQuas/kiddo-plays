# lite-rag

极简 RAG：`sentence-transformers`（嵌入）+ `Chroma`（离线持久化）+ `FAISS`（查询缓存加速）+ 标准库 HTTP。

## 安装

```bash
uv sync
```

## 子命令

### ① `embedding` — 离线建库（可多次调用，增量追加）

每次读一个纯文本文件 → 切 chunk → 嵌入 → **追加**到 Chroma；全量重建 FAISS 缓存。

```bash
uv run python main.py embedding sample/embedding.txt
uv run python main.py embedding sample/rag.txt      # 第二次：追加，不覆盖
uv run python main.py embedding sample/agent.txt --store ./store
```

多次调用会在 Chroma 里累积向量；每个 chunk 带 `source` 元数据记录来源文件。
`meta.json` 的 `files` 字段记录已嵌入的文件列表。

产出目录（默认 `./store/`）：

| 路径                | 角色                               |
| ------------------- | ---------------------------------- |
| `store/chroma/`     | **源数据**（向量 + 原文，持久化）  |
| `store/faiss.index` | **缓存**（FAISS 索引，可删可重建） |
| `store/meta.json`   | 缓存校验（model、count）           |

### ② `query` — 在线查询

从离线索引加载，**不重新 embed 文档**；FAISS 命中缓存则直接读盘，否则从 Chroma 重建（类似 Redis miss → 回源 DB）。

```bash
# 仅检索
uv run python main.py query "Embedding 是什么"

# 检索 + LLM 生成
export OPENAI_API_KEY=sk-...
uv run python main.py query "Embedding 是什么" --llm

# 向量空间可视化
uv run python main.py query "Embedding 是什么" --viz
uv run python main.py query "Embedding 是什么" --viz -d 3 -m tsne -o out.html
open viz.html
```

## 架构

```
embedding（离线，可多次）
  纯文本文件 → chunk → embed → Chroma 追加落盘
                              └→ 全量重建 FAISS 缓存

query（在线，多次）
  load() → Chroma 读向量/原文
         → FAISS 缓存有效？读 faiss.index : 从 Chroma 重建缓存
         → embed 仅用于「用户问题」
         → top-k 检索 → （可选）LLM / viz
```

| 组件                | 类比       | 职责                                       |
| ------------------- | ---------- | ------------------------------------------ |
| Chroma              | PostgreSQL | 离线向量 + 原文，唯一真相源                |
| FAISS               | Redis      | 查询加速缓存，丢失可从 Chroma 重建         |
| SentenceTransformer | —          | embedding 阶段编码文档；query 阶段编码问题 |

## RAG 逻辑

### Index（`embedding`）

1. Chunk：~400 字符窗口，50 overlap
2. Embed：`normalize_embeddings=True`（内积 = 余弦相似度）
3. Chroma：`ids / embeddings / documents`
4. FAISS：写 `faiss.index` + `meta.json`

### Query（`query`）

1. `load()`：从 Chroma 加载离线数据，预热 FAISS 缓存
2. Embed query：只编码用户问题
3. FAISS search：top-k，score = 余弦相似度
4. `--llm`：context + question → OpenAI 兼容 API
5. `--viz`：t-SNE / PCA 降 2D/3D，红色 = 命中，绿色 = 问题向量

## Python API

```python
from main import LiteRAG

# 离线（可多次追加）
rag = LiteRAG()
rag.embed("docs.txt")
rag.embed("notes.txt")

# 在线
rag = LiteRAG().load()
rag.search("Embedding 是什么")
rag.ask("Embedding 是什么")
rag.visualize(query="...", method="tsne", dims=3)
```
