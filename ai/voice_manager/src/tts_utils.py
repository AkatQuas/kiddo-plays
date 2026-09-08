import aiohttp

from audio_utils import encode_audio_bytes
from common.config import get_server_config
from common.log import logger
from http_client import auth_headers, get_http_session


async def tts_synthesize(
    text: str,
    ref_audio_bytes: bytes,
    ref_text: str,
    speed: float = 1.0,
    response_format: str = "wav",
    cross_lingual: bool = False,
) -> bytes | None:
    tts_config = get_server_config().tts_config
    url = tts_config.url.rstrip("/")

    audio_uri = encode_audio_bytes(ref_audio_bytes, "audio/wav")
    payload = {
        "input": text,
        "references": [{"audio": audio_uri, "text": ref_text}],
        "speed": speed,
        "response_format": response_format,
        "cross_lingual": cross_lingual,
    }

    try:
        timeout = aiohttp.ClientTimeout(total=120.0)
        session = await get_http_session()
        async with session.post(
            url,
            json=payload,
            timeout=timeout,
            headers=auth_headers(tts_config.api_key),
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                logger.error(f"TTS failed, status={response.status}, response={error_text}")
                return None
            data = await response.read()
        logger.info(f"TTS succeeded, text_len={len(text)}, output_bytes={len(data)}")
        return data
    except Exception as e:
        logger.error(f"TTS synthesize failed: {e}")
        return None
