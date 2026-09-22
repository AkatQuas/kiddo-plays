import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), 'third_party/Matcha-TTS'))
import argparse
import base64
import io
import logging
import wave
from typing import AsyncGenerator, Optional

import torch
import uvicorn
from async_cosyvoice import AsyncCosyVoice2
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from starlette.concurrency import run_in_threadpool
from utils import AsyncWrapper, _tensor_to_bytes

logger = logging.getLogger(__name__)

app = FastAPI()


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=34011, help="The tts server port.")
    parser.add_argument('--model_name_or_path', type=str, required=True, help='Path to the model directory')
    return parser.parse_args()


class TTSRequest(BaseModel):
    text: str = ''
    spk_id: str = '001'
    mode: Optional[str] = 'sft'
    stream: Optional[bool] = True
    speed: Optional[float] = 1.0
    sample_rate: Optional[int] = 24000


class ReferenceAudio(BaseModel):
    audio: str
    text: str


class OpenAITTSRequest(BaseModel):
    model: str
    input: str
    voice: Optional[str] = '001'
    response_format: Optional[str] = 'wav'
    speed: Optional[float] = 1.0

    class Config:
        extra = 'allow'


async def generator_wrapper(audio_data_generator: AsyncGenerator[dict, None]) -> AsyncGenerator[torch.Tensor, None]:
    async for chunk in audio_data_generator:
        yield chunk["tts_speech"]


async def generate_audio_content(request: TTSRequest, prompt_audio: Optional[bytes] = None, prompt_text: Optional[str] = None):
    text = request.text
    spk_id = request.spk_id

    try:
        if prompt_audio is not None and prompt_text:
            import torchaudio
            audio_tensor, sample_rate = torchaudio.load(io.BytesIO(prompt_audio))
            if sample_rate != 16000:
                audio_tensor = torchaudio.functional.resample(audio_tensor, sample_rate, 16000)
            prompt_speech_16k = audio_tensor.mean(dim=0, keepdim=True)

            audio_tensor_data_generator = generator_wrapper(cosyvoice.inference_zero_shot(
                text,
                prompt_text,
                prompt_speech_16k,
                stream=request.stream,
                speed=request.speed,
                text_frontend=True,
            ))
        elif spk_id:
            audio_tensor_data_generator = generator_wrapper(cosyvoice.inference_zero_shot_by_spk_id(
                text,
                spk_id,
                stream=request.stream,
                speed=request.speed,
                text_frontend=True,
            ))
        else:
            raise ValueError("Either provide prompt_audio+prompt_text or spk_id")

        if isinstance(audio_tensor_data_generator, torch.Tensor):
            audio_tensor_data_generator = AsyncWrapper([audio_tensor_data_generator])

        if not request.stream:
            tensor: torch.Tensor | None = None
            async for chunk in audio_tensor_data_generator:
                if tensor is not None:
                    tensor = torch.concat([tensor, chunk], dim=1)
                else:
                    tensor = chunk

            yield await run_in_threadpool(_tensor_to_bytes, tensor, "pcm", request.sample_rate)
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        else:
            async for chunk in audio_tensor_data_generator:
                if chunk.dtype != torch.int16:
                    chunk = chunk.to(torch.float32)
                    chunk = (chunk * 32767.0).clamp(-32768, 32767).to(torch.int16)

                chunk_bytes = chunk.numpy().tobytes()
                chunk_base64 = base64.b64encode(chunk_bytes).decode('utf-8')
                yield {
                    "event": "audio",
                    "data": chunk_base64
                }
            yield {
                "event": "done",
                "data": ""
            }
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    except Exception as e:
        logger.info(f"Processing failed: {str(e)}")
        yield {
            "event": "error",
            "data": str(e)
        }
        return


@app.post("/tts/streaming")
async def tts_stream_handler(request: TTSRequest):
    if request.mode != 'sft':
        raise HTTPException(status_code=400, detail=f"Unsupported mode: {request.mode}")

    if not request.spk_id:
        raise HTTPException(status_code=400, detail="spk_id is required for sft mode")

    return EventSourceResponse(generate_audio_content(request), ping=300)


@app.post("/v1/audio/speech")
async def openai_tts_handler(raw_request: Request):
    body = await raw_request.json()

    logger.info(f"Received raw body: {body}")

    prompt_audio = None
    prompt_text = None

    references = body.get('references', [])
    logger.info(f"References: {references}")

    if references and len(references) > 0:
        ref = references[0]
        audio_data_uri = ref.get('audio', '')
        prompt_text = ref.get('text', '')

        logger.info(f"Reference text: {prompt_text}")
        logger.info(f"Audio URI prefix: {audio_data_uri[:50] if audio_data_uri else 'empty'}")

        if audio_data_uri.startswith('data:audio/'):
            base64_data = audio_data_uri.split('base64,')[1] if 'base64,' in audio_data_uri else audio_data_uri.split(',')[1]
            prompt_audio = base64.b64decode(base64_data)
            logger.info(f"Decoded prompt audio, size: {len(prompt_audio)} bytes")

    tts_request = TTSRequest(
        text=body.get('input', ''),
        spk_id=body.get('voice', '001') if not prompt_audio else '001',
        mode='sft',
        stream=False,
        speed=body.get('speed', 1.0),
        sample_rate=24000
    )

    logger.info(f"Using voice clone: {prompt_audio is not None}, spk_id: {tts_request.spk_id}")

    response_format = body.get('response_format', 'wav')

    audio_chunks = []
    async for chunk in generate_audio_content(tts_request, prompt_audio, prompt_text):
        if isinstance(chunk, bytes):
            audio_chunks.append(chunk)

    if not audio_chunks:
        raise HTTPException(status_code=500, detail="No audio data generated")

    audio_data = b''.join(audio_chunks)

    if response_format == 'wav':
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(tts_request.sample_rate)
            wf.writeframes(audio_data)
        wav_buffer.seek(0)

        return StreamingResponse(
            wav_buffer,
            media_type='audio/wav',
            headers={'Content-Disposition': 'attachment; filename="speech.wav"'}
        )
    else:
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type='audio/pcm',
            headers={'Content-Disposition': 'attachment; filename="speech.pcm"'}
        )


if __name__ == '__main__':
    args = parse_args()
    cosyvoice = AsyncCosyVoice2(args.model_name_or_path, load_jit=True, load_trt=False, fp16=True)
    uvicorn.run(app, host='0.0.0.0', port=args.port)
