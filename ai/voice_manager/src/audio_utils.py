import base64
import io

import aiohttp
import pydub

from common.config import get_server_config
from common.exceptions import VoiceException
from common.log import logger
from http_client import auth_headers, get_http_session

MIN_DURATION_SECONDS = 10.0
MAX_DURATION_SECONDS = 30.0
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def encode_audio_bytes(audio_bytes: bytes, mime: str = "audio/wav") -> str:
    """将音频字节编码为 data URL (base64)。"""
    b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def validate_audio_file(audio_bytes: bytes) -> None:
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise VoiceException(status_code=400, detail="Audio sample too large (max 10MiB)")

    try:
        audio = pydub.AudioSegment.from_file(io.BytesIO(audio_bytes))
        duration_seconds = len(audio) / 1000.0

        if duration_seconds < MIN_DURATION_SECONDS or duration_seconds > MAX_DURATION_SECONDS:
            raise VoiceException(
                status_code=400,
                detail=(
                    f"Audio duration must be {MIN_DURATION_SECONDS:.0f}-{MAX_DURATION_SECONDS:.0f} "
                    f"seconds, got {duration_seconds:.2f}s"
                ),
            )
        logger.info(f"Audio validation passed duration={duration_seconds:.2f}s")
    except VoiceException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate audio: {e!s}")
        raise VoiceException(status_code=400, detail="Failed to validate audio") from e


async def asr_recognize(audio_bytes: bytes) -> str:
    asr_config = get_server_config().asr_config
    payload = {"audio": [encode_audio_bytes(audio_bytes)]}
    timeout = aiohttp.ClientTimeout(total=60)
    session = await get_http_session()
    try:
        async with session.post(
            asr_config.url,
            json=payload,
            timeout=timeout,
            headers=auth_headers(asr_config.api_key),
        ) as resp:
            resp.raise_for_status()
            result = await resp.json()
    except aiohttp.ClientError as e:
        logger.error(f"ASR request failed: {e}")
        raise VoiceException(status_code=500, detail="ASR recognition failed") from e
    except (ValueError, KeyError) as e:
        logger.error(f"ASR response parse failed: {e}")
        raise VoiceException(status_code=500, detail="ASR recognition failed") from e

    if not result:
        return ""
    text = result.get("data", {}).get("text", "")
    logger.info(f"ASR recognition succeeded, text length={len(text)}")
    return text
