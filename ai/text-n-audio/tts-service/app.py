"""
Local TTS microservice — Piper ONNX voice, SSE stream of base64 PCM16 chunks.

POST JSON { text, spk_id? } → SSE:
  data: <base64 pcm16>
  event: done
"""

from __future__ import annotations

import base64
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from scipy import signal

_voice = None
_native_rate: int = 22050
_output_rate: int = 24000


def _hf_endpoint() -> str:
    return os.environ.get("HF_ENDPOINT", "https://huggingface.co").rstrip("/")


def _download_piper_model() -> tuple[Path, Path]:
    from huggingface_hub import hf_hub_download

    repo = os.environ.get("PIPER_VOICE_REPO", "rhasspy/piper-voices")
    model_file = os.environ.get(
        "PIPER_MODEL_FILE",
        "zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx",
    )
    config_file = f"{model_file}.json"
    model_path = Path(
        hf_hub_download(
            repo_id=repo,
            filename=model_file,
            endpoint=_hf_endpoint(),
        )
    )
    config_path = Path(
        hf_hub_download(
            repo_id=repo,
            filename=config_file,
            endpoint=_hf_endpoint(),
        )
    )
    return model_path, config_path


def _load_voice():
    global _voice, _native_rate, _output_rate
    from piper import PiperVoice

    _output_rate = int(os.environ.get("TTS_SAMPLE_RATE", "24000"))
    model_path, _config_path = _download_piper_model()
    _voice = PiperVoice.load(str(model_path))
    _native_rate = int(getattr(_voice, "config", None) and _voice.config.sample_rate or 22050)
    return _voice


def _iter_pcm_bytes(voice, text: str):
    if hasattr(voice, "synthesize_stream_raw"):
        yield from voice.synthesize_stream_raw(text)
        return
    for chunk in voice.synthesize(text):
        if hasattr(chunk, "audio_int16_bytes"):
            yield chunk.audio_int16_bytes
        elif isinstance(chunk, (bytes, bytearray)):
            yield bytes(chunk)


def _resample_pcm16(pcm: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    if src_rate == dst_rate or pcm.size == 0:
        return pcm
    gcd = np.gcd(src_rate, dst_rate)
    up = dst_rate // gcd
    down = src_rate // gcd
    resampled = signal.resample_poly(pcm.astype(np.float32), up, down)
    resampled = np.clip(resampled, -32768, 32767).astype(np.int16)
    return resampled


def _split_sentences(text: str) -> list[str]:
    import re

    parts = re.split(r"([。！？!?；;，,])", text.strip())
    merged: list[str] = []
    buf = ""
    for part in parts:
        if not part:
            continue
        buf += part
        if re.match(r"[。！？!?；;，,]", part) or len(buf) >= 24:
            merged.append(buf.strip())
            buf = ""
    if buf.strip():
        merged.append(buf.strip())
    return [p for p in merged if p]


def _synthesize_pcm16(text: str) -> np.ndarray:
    voice = _voice or _load_voice()
    raw = b"".join(_iter_pcm_bytes(voice, text))
    pcm = np.frombuffer(raw, dtype=np.int16)
    return _resample_pcm16(pcm, _native_rate, _output_rate)


def _sse_chunk(b64: str) -> str:
    return f"data: {b64}\n\n"


def _sse_done() -> str:
    return "event: done\ndata: \n\n"


async def _stream_tts(text: str, chunk_samples: int = 4096) -> AsyncIterator[str]:
    sentences = _split_sentences(text)
    if not sentences:
        sentences = [text.strip()] if text.strip() else []

    for sentence in sentences:
        pcm = _synthesize_pcm16(sentence)
        if pcm.size == 0:
            continue
        for offset in range(0, pcm.size, chunk_samples):
            piece = pcm[offset : offset + chunk_samples]
            b64 = base64.b64encode(piece.tobytes()).decode("ascii")
            yield _sse_chunk(b64)

    yield _sse_done()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        _load_voice()
        print(f"[tts] piper ready @ {_native_rate}Hz -> {_output_rate}Hz")
    except Exception as exc:
        print(f"[tts] preload skipped: {exc}")
    yield

    # 服务关闭时执行清理
    print("[tts] releasing voice engine resources")

app = FastAPI(title="text-n-audio-tts", lifespan=lifespan)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    spk_id: str | int | None = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "loaded": _voice is not None,
        "sample_rate": _output_rate,
        "model": os.environ.get("PIPER_MODEL_FILE", "zh_CN-huayan-medium"),
    }


@app.post("/tts/stream")
async def tts_stream(body: TTSRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty text")

    return StreamingResponse(
        _stream_tts(text),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
