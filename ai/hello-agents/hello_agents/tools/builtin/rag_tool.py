import os
from typing import Any, Dict, List

from ...core.llm import HelloAgentsLLM
from ..base import Tool


def _approx_token_len(text: str) -> int:
    """Approximate token length estimation, supports Chinese-English mixed text"""
    # CJK characters counted as 1 token each
    cjk = sum(1 for ch in text if _is_cjk(ch))
    # Other characters counted by whitespace tokenization
    non_cjk_tokens = len([t for t in text.split() if t])
    return cjk + non_cjk_tokens

def _is_cjk(ch: str) -> bool:
    """Determine if character is CJK"""
    code = ord(ch)
    return (
        0x4E00 <= code <= 0x9FFF or  # CJK Unified Ideographs
        0x3400 <= code <= 0x4DBF or  # CJK Extension A
        0x20000 <= code <= 0x2A6DF or # CJK Extension B
        0x2A700 <= code <= 0x2B73F or # CJK Extension C
        0x2B740 <= code <= 0x2B81F or # CJK Extension D
        0x2B820 <= code <= 0x2CEAF or # CJK Extension E
        0xF900 <= code <= 0xFAFF      # CJK Compatibility Ideographs
    )

def _convert_to_markdown(path: str) -> str:
    """
    Universal document reader using MarkItDown with enhanced PDF processing.
    Core function: Convert documents of any format to Markdown text

    Supported formats:
    - Documents: PDF, Word, Excel, PowerPoint
    - Images: JPG, PNG, GIF (via OCR)
    - Audio: MP3, WAV, M4A (via transcription)
    - Text: TXT, CSV, JSON, XML, HTML
    - Code: Python, JavaScript, Java, etc.
    """
    if not os.path.exists(path):
        return ""

    # Use enhanced processing for PDF files
    ext = (os.path.splitext(path)[1] or '').lower()
    if ext == '.pdf':
        return _enhanced_pdf_processing(path)

    # Use MarkItDown unified conversion for other formats
    md_instance = _get_markitdown_instance()
    if md_instance is None:
        return _fallback_text_reader(path)

    try:
        result = md_instance.convert(path)
        markdown_text = getattr(result, "text_content", None)
        if isinstance(markdown_text, str) and markdown_text.strip():
            print(f"[RAG] MarkItDown conversion successful: {path} -> {len(markdown_text)} chars Markdown")
            return markdown_text
        return ""
    except Exception as e:
        print(f"[WARNING] MarkItDown conversion failed {path}: {e}")
        return _fallback_text_reader(path)

def _split_paragraphs_with_headings(text: str) -> List[Dict]:
    """Split paragraphs based on heading hierarchy, maintaining semantic integrity"""
    lines = text.splitlines()
    heading_stack: List[str] = []
    paragraphs: List[Dict] = []
    buf: List[str] = []
    char_pos = 0

    def flush_buf(end_pos: int):
        if not buf:
            return
        content = "\n".join(buf).strip()
        if not content:
            return
        paragraphs.append({
            "content": content,
            "heading_path": " > ".join(heading_stack) if heading_stack else None,
            "start": max(0, end_pos - len(content)),
            "end": end_pos,
        })

    for ln in lines:
        raw = ln
        if raw.strip().startswith("#"):
            # Process heading line
            flush_buf(char_pos)
            level = len(raw) - len(raw.lstrip('#'))
            title = raw.lstrip('#').strip()

            if level <= 0:
                level = 1
            if level <= len(heading_stack):
                heading_stack = heading_stack[:level-1]
            heading_stack.append(title)

            char_pos += len(raw) + 1
            continue

        # Accumulate paragraph content
        if raw.strip() == "":
            flush_buf(char_pos)
            buf = []
        else:
            buf.append(raw)
        char_pos += len(raw) + 1

    flush_buf(char_pos)

    if not paragraphs:
        paragraphs = [{"content": text, "heading_path": None, "start": 0, "end": len(text)}]

    return paragraphs

def _chunk_paragraphs(paragraphs: List[Dict], chunk_tokens: int, overlap_tokens: int) -> List[Dict]:
    """Intelligent chunking based on token count"""
    chunks: List[Dict] = []
    cur: List[Dict] = []
    cur_tokens = 0
    i = 0

    while i < len(paragraphs):
        p = paragraphs[i]
        p_tokens = _approx_token_len(p["content"]) or 1

        if cur_tokens + p_tokens <= chunk_tokens or not cur:
            cur.append(p)
            cur_tokens += p_tokens
            i += 1
        else:
            # Generate current chunk
            content = "\n\n".join(x["content"] for x in cur)
            start = cur[0]["start"]
            end = cur[-1]["end"]
            heading_path = next((x["heading_path"] for x in reversed(cur) if x.get("heading_path")), None)

            chunks.append({
                "content": content,
                "start": start,
                "end": end,
                "heading_path": heading_path,
            })

            # Build overlap section
            if overlap_tokens > 0 and cur:
                kept: List[Dict] = []
                kept_tokens = 0
                for x in reversed(cur):
                    t = _approx_token_len(x["content"]) or 1
                    if kept_tokens + t > overlap_tokens:
                        break
                    kept.append(x)
                    kept_tokens += t
                cur = list(reversed(kept))
                cur_tokens = kept_tokens
            else:
                cur = []
                cur_tokens = 0

    # Process last chunk
    if cur:
        content = "\n\n".join(x["content"] for x in cur)
        start = cur[0]["start"]
        end = cur[-1]["end"]
        heading_path = next((x["heading_path"] for x in reversed(cur) if x.get("heading_path")), None)

        chunks.append({
            "content": content,
            "start": start,
            "end": end,
            "heading_path": heading_path,
        })

    return chunks

def index_chunks(
    store = None,
    chunks: List[Dict] | None= None,
    cache_db: str | None = None,
    batch_size: int = 64,
    rag_namespace: str = "default"
) -> None:
    """
    Index markdown chunks with unified embedding and Qdrant storage.
    Uses Bailian API with fallback to sentence-transformers.
    """
    if not chunks:
        print("[RAG] No chunks to index")
        return

    # Use unified embedding model
    embedder = get_text_embedder()
    dimension = get_dimension(384)

    # Create default Qdrant storage
    if store is None:
        store = _create_default_vector_store(dimension)
        print(f"[RAG] Created default Qdrant store with dimension {dimension}")

    # Preprocess Markdown text for better embedding quality
    processed_texts = []
    for c in chunks:
        raw_content = c["content"]
        processed_content = _preprocess_markdown_for_embedding(raw_content)
        processed_texts.append(processed_content)

    print(f"[RAG] Embedding start: total_texts={len(processed_texts)} batch_size={batch_size}")

    # Batch encoding
    vecs: List[List[float]] = []
    for i in range(0, len(processed_texts), batch_size):
        part = processed_texts[i:i+batch_size]
        try:
            # Use unified embedder (handles caching internally)
            part_vecs = embedder.encode(part)

            # Standardize to List[List[float]] format
            if not isinstance(part_vecs, list):
                if hasattr(part_vecs, "tolist"):
                    part_vecs = [part_vecs.tolist()]
                else:
                    part_vecs = [list(part_vecs)]

            # Process vector format and dimension
            for v in part_vecs:
                try:
                    if hasattr(v, "tolist"):
                        v = v.tolist()
                    v_norm = [float(x) for x in v]

                    # Dimension check and adjustment
                    if len(v_norm) != dimension:
                        print(f"[WARNING] Vector dimension anomaly: expected {dimension}, actual {len(v_norm)}")
                        if len(v_norm) < dimension:
                            v_norm.extend([0.0] * (dimension - len(v_norm)))
                        else:
                            v_norm = v_norm[:dimension]

                    vecs.append(v_norm)
                except Exception as e:
                    print(f"[WARNING] Vector conversion failed: {e}, using zero vector")
                    vecs.append([0.0] * dimension)

        except Exception as e:
            print(f"[WARNING] Batch {i} encoding failed: {e}")
            # Implement retry mechanism
            # ... retry logic ...

        print(f"[RAG] Embedding progress: {min(i+batch_size, len(processed_texts))}/{len(processed_texts)}")

def _prompt_mqe(query: str, n: int) -> List[str]:
    """Use LLM to generate diverse query expansions"""
    try:
        from ...core.llm import HelloAgentsLLM
        llm = HelloAgentsLLM()
        prompt = [
            {"role": "system", "content": "You are a retrieval query expansion assistant. Generate semantically equivalent or complementary diverse queries. Use Chinese, keep it short, avoid punctuation."},
            {"role": "user", "content": f"Original query: {query}\nPlease provide {n} differently phrased queries, one per line."}
        ]
        text = llm.invoke(prompt)
        lines = [ln.strip("- \t") for ln in (text or "").splitlines()]
        outs = [ln for ln in lines if ln]
        return outs[:n] or [query]
    except Exception:
        return [query]

def _prompt_hyde(query: str) -> str | None:
    """Generate hypothetical document to improve retrieval"""
    try:
        from ...core.llm import HelloAgentsLLM
        llm = HelloAgentsLLM()
        prompt = [
            {"role": "system", "content": "Based on the user's question, first write a possible answer paragraph for use as a query document in vector retrieval (no analysis process)."},
            {"role": "user", "content": f"Question: {query}\nPlease directly write a medium-length, objective paragraph containing key terminology."}
        ]
        return llm.invoke(prompt)
    except Exception:
        return None

def search_vectors_expanded(
    store = None,
    query: str = "",
    top_k: int = 8,
    rag_namespace: str | None = None,
    only_rag_data: bool = True,
    score_threshold: float | None = None,
    enable_mqe: bool = False,
    mqe_expansions: int = 2,
    enable_hyde: bool = False,
    candidate_pool_multiplier: int = 4,
) -> List[Dict]:
    """
    Search with query expansion using unified embedding and Qdrant.
    """
    if not query:
        return []

    # Create default storage
    if store is None:
        store = _create_default_vector_store()

    # Query expansion
    expansions: List[str] = [query]

    if enable_mqe and mqe_expansions > 0:
        expansions.extend(_prompt_mqe(query, mqe_expansions))
    if enable_hyde:
        hyde_text = _prompt_hyde(query)
        if hyde_text:
            expansions.append(hyde_text)

    # Deduplication and trimming
    uniq: List[str] = []
    for e in expansions:
        if e and e not in uniq:
            uniq.append(e)
    expansions = uniq[: max(1, len(uniq))]

    # Allocate candidate pool
    pool = max(top_k * candidate_pool_multiplier, 20)
    per = max(1, pool // max(1, len(expansions)))

    # Build RAG data filter
    where = {"memory_type": "rag_chunk"}
    if only_rag_data:
        where["is_rag_data"] = True
        where["data_source"] = "rag_pipeline"
    if rag_namespace:
        where["rag_namespace"] = rag_namespace

    # Collect results from all expanded queries
    agg: Dict[str, Dict] = {}
    for q in expansions:
        qv = embed_query(q)
        hits = store.search_similar(
            query_vector=qv,
            limit=per,
            score_threshold=score_threshold,
            where=where
        )
        for h in hits:
            mid = h.get("metadata", {}).get("memory_id", h.get("id"))
            s = float(h.get("score", 0.0))
            if mid not in agg or s > float(agg[mid].get("score", 0.0)):
                agg[mid] = h

    # Sort by score and return
    merged = list(agg.values())
    merged.sort(key=lambda x: float(x.get("score", 0.0)), reverse=True)
    return merged[:top_k]


class RAGTool(Tool):
    """RAG tool

    Provides complete RAG capabilities:
    - Add multi-format documents (PDF, Office, images, audio, etc.)
    - Intelligent retrieval and recall
    - LLM-enhanced Q&A
    - Knowledge base management
    """

    def __init__(
        self,
        knowledge_base_path: str = "./knowledge_base",
        qdrant_url: str | None = None,
        qdrant_api_key: str | None = None,
        collection_name: str = "rag_knowledge_base",
        rag_namespace: str = "default"
    ):
        # Initialize RAG pipeline
        self._pipelines: Dict[str, Dict[str, Any]] = {}
        self.llm = HelloAgentsLLM()

        # Create default pipeline
        # Any format document → MarkItDown conversion → Markdown text → Intelligent chunking → Vectorization → Storage and retrieval

        default_pipeline = create_rag_pipeline(
            qdrant_url=self.qdrant_url,
            qdrant_api_key=self.qdrant_api_key,
            collection_name=self.collection_name,
            rag_namespace=self.rag_namespace
        )
        self._pipelines[self.rag_namespace] = default_pipeline
