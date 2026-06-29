"""
Local ASR microservice — faster-whisper on short WAV chunks.
Model downloads from Hugging Face on first request (respects HF_ENDPOINT).
"""

from __future__ import annotations

import io
import os
import wave
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

_model = None
_model_name: Optional[str] = None


def _load_model():
    global _model, _model_name
    from faster_whisper import WhisperModel

    name = os.environ.get("WHISPER_MODEL", "Systran/faster-whisper-base")
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    compute = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
    if _model is None or _model_name != name:
        _model = WhisperModel(name, device=device, compute_type=compute)
        _model_name = name
    return _model


def wav_bytes_to_float32(data: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(data), "rb") as wf:
        channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if sample_width != 2:
        raise ValueError(f"unsupported sample width: {sample_width}")

    pcm = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        pcm = pcm.reshape(-1, channels).mean(axis=1)
    return pcm, rate


def transcribe_wav(data: bytes, language: str = "zh") -> str:
    if len(data) < 44:
        return ""

    try:
        audio, _rate = wav_bytes_to_float32(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid wav: {exc}") from exc

    if audio.size < 1600:
        return ""

    model = _load_model()
    segments, _info = model.transcribe(
        audio,
        language=language,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=300),
    )
    parts = [seg.text.strip() for seg in segments if seg.text.strip()]
    text = "".join(parts)
    return text.rstrip("。")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        _load_model()
    except Exception as exc:
        print(f"[asr] model preload skipped (will retry on first request): {exc}")
    yield

    # 服务关闭时执行清理
    print("[asr] releasing model resources")

app = FastAPI(title="text-n-audio-asr", lifespan=lifespan)


class TranscribeResponse(BaseModel):
    text: str
    model: str


@app.get("/health")
def health():
    return {
        "ok": True,
        "model": os.environ.get("WHISPER_MODEL", "Systran/faster-whisper-base"),
        "loaded": _model is not None,
    }


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str = "zh",
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty body")
    text = transcribe_wav(data, language=language)
    return TranscribeResponse(
        text=text,
        model=os.environ.get("WHISPER_MODEL", "Systran/faster-whisper-base"),
    )


@app.post("/transcribe/raw", response_model=TranscribeResponse)
async def transcribe_raw(request: Request, language: str = "zh"):
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty body")
    text = transcribe_wav(body, language=language)
    return TranscribeResponse(
        text=text,
        model=os.environ.get("WHISPER_MODEL", "Systran/faster-whisper-base"),
    )
