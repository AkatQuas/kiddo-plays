"""Minimal RAG: sentence-transformers + FAISS + Chroma, no framework."""
import argparse
import json
import os
import re
import urllib.request

import chromadb
import faiss
import numpy as np
import plotly.graph_objects as go
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE


class LiteRAG:
    def __init__(self, model="all-MiniLM-L6-v2", top_k=3, store_dir=None):
        self.model_name = model
        self.top_k = top_k
        self.store_dir = store_dir or os.path.join(os.path.dirname(__file__), "store")
        self.chroma_path = os.path.join(self.store_dir, "chroma")
        self.faiss_path = os.path.join(self.store_dir, "faiss.index")
        self.meta_path = os.path.join(self.store_dir, "meta.json")
        self.encoder = None
        self.chunks, self.index, self.collection, self.chroma = [], None, None, None

    def _get_encoder(self):
        if self.encoder is None:
            self.encoder = SentenceTransformer(self.model_name)
        return self.encoder

    def _get_chroma(self):
        if self.chroma is None:
            os.makedirs(self.store_dir, exist_ok=True)
            self.chroma = chromadb.PersistentClient(path=self.chroma_path)
        return self.chroma

    def _chunk(self, text, size=400, overlap=50):
        text = re.sub(r"\n{3,}", "\n\n", text.strip())
        if len(text) <= size:
            return [text] if text else []
        out, start = [], 0
        while start < len(text):
            end = min(start + size, len(text))
            if end < len(text):
                sp = text.rfind(" ", start, end)
                if sp > start:
                    end = sp
            out.append(text[start:end].strip())
            start = max(end - overlap, end) if end < len(text) else len(text)
        return [c for c in out if c]

    def _embed(self, texts):
        return np.asarray(
            self._get_encoder().encode(texts, normalize_embeddings=True), dtype="float32"
        )

    def _read_meta(self):
        if os.path.exists(self.meta_path):
            with open(self.meta_path, encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _write_meta(self, count, source_file=None):
        meta = self._read_meta()
        meta["model"] = self.model_name
        meta["count"] = count
        if source_file:
            files = list(dict.fromkeys(meta.get("files", []) + [source_file]))
            meta["files"] = files
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    def _ensure_collection(self):
        client = self._get_chroma()
        self.collection = client.get_or_create_collection(
            "lite_rag",
            metadata={"hnsw:space": "cosine", "embedding_model": self.model_name},
        )
        stored_model = (self.collection.metadata or {}).get("embedding_model")
        if stored_model and stored_model != self.model_name:
            raise ValueError(
                f"Model mismatch: index uses {stored_model!r}, got {self.model_name!r}"
            )

    def _ordered_chroma_data(self):
        data = self.collection.get(include=["embeddings", "documents"])
        order = sorted(range(len(data["ids"])), key=lambda i: int(data["ids"][i]))
        vecs = np.asarray([data["embeddings"][i] for i in order], dtype="float32")
        docs = [data["documents"][i] for i in order]
        return vecs, docs

    def embed(self, text_file):
        """Offline indexing: append chunks from a text file; rebuild FAISS cache."""
        text_file = os.path.abspath(text_file)
        with open(text_file, encoding="utf-8") as f:
            chunks = self._chunk(f.read())
        if not chunks:
            raise ValueError(f"No content in {text_file}")

        self._ensure_collection()
        existing = self.collection.get(include=[])
        next_id = max((int(i) for i in existing["ids"]), default=-1) + 1

        vecs = self._embed(chunks)
        self.collection.add(
            ids=[str(next_id + i) for i in range(len(chunks))],
            embeddings=vecs.tolist(),
            documents=chunks,
            metadatas=[{"source": text_file}] * len(chunks),
        )

        all_vecs, all_docs = self._ordered_chroma_data()
        self.chunks = all_docs
        self._write_faiss_cache(all_vecs)
        self._write_meta(len(all_docs), source_file=text_file)
        print(
            f"Added {len(chunks)} chunks from {text_file} "
            f"(total {len(all_docs)}) → {self.store_dir}"
        )

    def load(self):
        """Online query prep: load offline vectors from Chroma; warm FAISS cache if needed."""
        client = self._get_chroma()
        self.collection = client.get_or_create_collection("lite_rag")
        data = self.collection.get(include=["documents"])
        if not data["ids"]:
            raise ValueError(f"No index at {self.store_dir}. Run: embedding <file>")

        stored_model = (self.collection.metadata or {}).get("embedding_model")
        if stored_model:
            self.model_name = stored_model

        pairs = sorted(zip(data["ids"], data["documents"]), key=lambda x: int(x[0]))
        self.chunks = [doc for _, doc in pairs]
        meta = {}
        if os.path.exists(self.meta_path):
            with open(self.meta_path, encoding="utf-8") as f:
                meta = json.load(f)

        if self._faiss_cache_valid(meta):
            self.index = faiss.read_index(self.faiss_path)
        else:
            self._rebuild_faiss_cache()
        return self

    def _faiss_cache_valid(self, meta):
        return (
            os.path.exists(self.faiss_path)
            and meta.get("count") == len(self.chunks)
            and meta.get("model") == self.model_name
        )

    def _write_faiss_cache(self, vecs):
        index = faiss.IndexFlatIP(vecs.shape[1])
        index.add(vecs)
        faiss.write_index(index, self.faiss_path)

    def _rebuild_faiss_cache(self):
        """Cache miss: rebuild FAISS from Chroma embeddings (like warming Redis from DB)."""
        all_vecs, all_docs = self._ordered_chroma_data()
        self.chunks = all_docs
        self._write_faiss_cache(all_vecs)
        self.index = faiss.read_index(self.faiss_path)
        self._write_meta(len(all_docs))
        print(f"FAISS cache rebuilt from Chroma ({len(all_docs)} vectors)")

    def search(self, query, k=None):
        k = k or self.top_k
        if not self.index:
            raise RuntimeError("Index not loaded. Call load() first.")
        q = self._embed([query])
        scores, ids = self.index.search(q, min(k, len(self.chunks)))
        return [(self.chunks[i], float(s)) for s, i in zip(scores[0], ids[0]) if i >= 0]

    def _reduce(self, X, method="tsne", dims=2, q=None):
        method, dims = method.lower(), int(dims)
        if dims not in (2, 3):
            raise ValueError("dims must be 2 or 3")
        if method == "pca":
            pca = PCA(n_components=dims)
            coords = pca.fit_transform(X)
            q_coord = pca.transform(q.reshape(1, -1))[0] if q is not None else None
            return coords, q_coord
        if method != "tsne":
            raise ValueError("method must be 'tsne' or 'pca'")
        combined = np.vstack([X, q.reshape(1, -1)]) if q is not None else X
        n = len(combined)
        if n < 2:
            raise ValueError("Need at least 2 vectors for t-SNE")
        coords = TSNE(
            n_components=dims,
            perplexity=min(30, max(2, n - 1)),
            random_state=42,
            init="pca",
            learning_rate="auto",
        ).fit_transform(combined)
        if q is not None:
            return coords[:-1], coords[-1]
        return coords, None

    def visualize(self, query=None, k=None, out="viz.html", method="tsne", dims=2):
        data = self.collection.get(include=["embeddings", "documents"])
        if not data["ids"]:
            raise ValueError("No documents indexed.")

        ids, docs = data["ids"], data["documents"]
        X = np.asarray(data["embeddings"], dtype="float32")
        hit_ids, q_vec = set(), None
        if query:
            k = k or self.top_k
            q_vec = self._embed([query])[0]
            _, faiss_ids = self.index.search(q_vec.reshape(1, -1), min(k, len(self.chunks)))
            hit_ids = {str(i) for i in faiss_ids[0] if i >= 0}

        coords, q_coord = self._reduce(X, method=method, dims=dims, q=q_vec)
        labels = [d[:120] + ("…" if len(d) > 120 else "") for d in docs]
        colors = ["#ef4444" if i in hit_ids else "#94a3b8" for i in ids]
        sizes = [11 if i in hit_ids else 7 for i in ids]

        if dims == 2:
            fig = go.Figure(
                go.Scatter(
                    x=coords[:, 0],
                    y=coords[:, 1],
                    mode="markers",
                    marker=dict(color=colors, size=sizes, opacity=0.85),
                    text=labels,
                    hovertemplate="chunk %{text}<extra></extra>",
                    name="chunks",
                )
            )
            if q_coord is not None:
                fig.add_trace(
                    go.Scatter(
                        x=[q_coord[0]],
                        y=[q_coord[1]],
                        mode="markers+text",
                        marker=dict(color="#22c55e", size=14, symbol="star"),
                        text=[f"Q: {query[:40]}"],
                        textposition="top center",
                        name="query",
                    )
                )
            axis = ("PC1", "PC2") if method == "pca" else ("t-SNE 1", "t-SNE 2")
            fig.update_layout(xaxis_title=axis[0], yaxis_title=axis[1])
        else:
            fig = go.Figure(
                go.Scatter3d(
                    x=coords[:, 0],
                    y=coords[:, 1],
                    z=coords[:, 2],
                    mode="markers",
                    marker=dict(color=colors, size=sizes, opacity=0.85),
                    text=labels,
                    hovertemplate="chunk %{text}<extra></extra>",
                    name="chunks",
                )
            )
            if q_coord is not None:
                fig.add_trace(
                    go.Scatter3d(
                        x=[q_coord[0]],
                        y=[q_coord[1]],
                        z=[q_coord[2]],
                        mode="markers+text",
                        marker=dict(color="#22c55e", size=8, symbol="diamond"),
                        text=[f"Q: {query[:40]}"],
                        name="query",
                    )
                )
            axis = ("PC1", "PC2", "PC3") if method == "pca" else ("t-SNE 1", "t-SNE 2", "t-SNE 3")
            fig.update_layout(scene=dict(xaxis_title=axis[0], yaxis_title=axis[1], zaxis_title=axis[2]))

        fig.update_layout(
            title=f"Embedding space ({method.upper()} {dims}D) — red = retrieved, green = query",
            template="plotly_white",
            height=720 if dims == 3 else 620,
        )
        fig.write_html(out, include_plotlyjs="cdn")
        return out

    def _llm(self, prompt):
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            return None
        base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}]})
        req = urllib.request.Request(
            f"{base.rstrip('/')}/chat/completions",
            data=body.encode(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())["choices"][0]["message"]["content"]

    def ask(self, question, k=None):
        hits = self.search(question, k)
        ctx = "\n\n".join(f"[{i + 1}] {c}" for i, (c, _) in enumerate(hits))
        prompt = (
            "Answer only from the context. If unknown, say you don't know.\n\n"
            f"Context:\n{ctx}\n\nQuestion: {question}"
        )
        return self._llm(prompt) or f"(no OPENAI_API_KEY)\n\nRetrieved:\n{ctx}"


def cmd_embedding(args):
    LiteRAG(model=args.model, store_dir=args.store).embed(args.file)


def cmd_query(args):
    rag = LiteRAG(model=args.model, top_k=args.top_k, store_dir=args.store).load()
    if args.viz:
        out = rag.visualize(
            query=args.question,
            out=args.output,
            method=args.method,
            dims=args.dims,
        )
        print(f"Wrote {out}")
        return
    if args.llm:
        print(rag.ask(args.question))
        return
    for i, (chunk, score) in enumerate(rag.search(args.question), 1):
        print(f"\n[{i}] score={score:.3f}\n{chunk}")


def main():
    parser = argparse.ArgumentParser(description="lite-rag")
    parser.add_argument("--store", default=os.path.join(os.path.dirname(__file__), "store"))
    parser.add_argument("--model", default="all-MiniLM-L6-v2")
    sub = parser.add_subparsers(dest="command", required=True)

    p_embed = sub.add_parser("embedding", help="offline: embed plain text file(s), append to index")
    p_embed.add_argument("file", help="path to .txt file")
    p_embed.set_defaults(func=cmd_embedding)

    p_query = sub.add_parser("query", help="online: search loaded offline index")
    p_query.add_argument("question", help="query text")
    p_query.add_argument("-k", "--top-k", type=int, default=3)
    p_query.add_argument("--llm", action="store_true", help="retrieve + LLM answer")
    p_query.add_argument("--viz", action="store_true", help="t-SNE/PCA visualization")
    p_query.add_argument("-o", "--output", default="viz.html")
    p_query.add_argument("-m", "--method", choices=("tsne", "pca"), default="tsne")
    p_query.add_argument("-d", "--dims", type=int, choices=(2, 3), default=2)
    p_query.set_defaults(func=cmd_query)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
