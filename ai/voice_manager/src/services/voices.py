import asyncio
import base64

from audio_utils import asr_recognize, validate_audio_file
from common.exceptions import DuplicateVoiceError, VoiceException
from common.log import logger
from file_utils import delete_file, save_file_bytes
from schemas.voice import VoiceCreate, VoiceCreated, VoicePage, VoiceRead
from tts_utils import tts_synthesize
from voice_model import VoiceMetaModel


def decode_audio_data(audio_data: str) -> bytes:
    if "," in audio_data:
        audio_data = audio_data.split(",", 1)[1]
    audio_data = "".join(audio_data.split())
    pad = (-len(audio_data)) % 4
    if pad:
        audio_data += "=" * pad
    try:
        return base64.b64decode(audio_data, validate=True)
    except Exception as e:
        raise VoiceException(status_code=400, detail="Invalid base64 audio data") from e


async def _run_db(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


def _to_read(voice) -> VoiceRead:
    return VoiceRead.model_validate(voice)


def _get_voice(db: VoiceMetaModel, voice_id: int, user_id: str, *, is_public: bool):
    voice_meta = db.get_voice_by_id(voice_id, user_id, is_public=is_public)
    if voice_meta is None:
        raise VoiceException(status_code=404, detail=f"Voice not found: {voice_id}")
    return voice_meta


async def get_voice(
    db: VoiceMetaModel, voice_id: int, user_id: str, *, is_public: bool
) -> VoiceRead:
    voice = await _run_db(_get_voice, db, voice_id, user_id, is_public=is_public)
    return _to_read(voice)


async def list_voices(
    db: VoiceMetaModel,
    user_id: str,
    *,
    is_public: bool,
    offset: int,
    limit: int,
) -> VoicePage:
    if is_public:
        voices, total = await _run_db(db.list_public_voices, offset=offset, limit=limit)
    else:
        voices, total = await _run_db(db.list_voices_by_user, user_id, offset=offset, limit=limit)
    logger.info(
        "Listed %s voices user_id=%s is_public=%s",
        len(voices),
        user_id,
        is_public,
    )
    return VoicePage(
        items=[_to_read(v) for v in voices],
        offset=offset,
        limit=limit,
        total=total,
    )


async def delete_voice(db: VoiceMetaModel, voice_id: int, user_id: str, *, is_public: bool) -> None:
    voice_meta = await _run_db(_get_voice, db, voice_id, user_id, is_public=is_public)
    try:
        if voice_meta.is_public:
            await _run_db(db.delete_public_voice, voice_id)
        else:
            await _run_db(db.delete_private_voice, voice_id, user_id)
    except ValueError:
        raise VoiceException(status_code=404, detail=f"Voice not found: {voice_id}") from None
    except VoiceException:
        raise
    except Exception:
        logger.exception("Failed to delete voice voice_id=%s user_id=%s", voice_id, user_id)
        raise VoiceException(status_code=500, detail="Failed to delete voice") from None

    try:
        await delete_file(voice_meta.voice_path)
    except Exception:
        logger.exception(
            "Voice row deleted but object remains path=%s voice_id=%s",
            voice_meta.voice_path,
            voice_id,
        )
    logger.info("Voice deleted user_id=%s voice_id=%s", user_id, voice_id)


async def create_voice(
    db: VoiceMetaModel,
    user_id: str,
    body: VoiceCreate,
    *,
    is_public: bool,
) -> VoiceCreated:
    logger.info(
        "Creating voice user_id=%s voice_name=%s is_public=%s",
        user_id,
        body.voice_name,
        is_public,
    )

    audio_bytes = decode_audio_data(body.audio_data)
    await asyncio.to_thread(validate_audio_file, audio_bytes)

    voice_content = body.audio_content.strip() if body.audio_content else ""
    if not voice_content:
        voice_content = (await asr_recognize(audio_bytes)).strip()
    if not voice_content:
        raise VoiceException(status_code=400, detail="Voice content is empty")

    try:
        voice_path = await save_file_bytes(audio_bytes)
    except Exception:
        raise VoiceException(status_code=500, detail="Failed to save audio file") from None

    try:
        voice_meta = await _run_db(
            db.create_voice_meta,
            user_id,
            body.voice_name,
            voice_path,
            voice_content,
            is_public,
        )
    except DuplicateVoiceError as e:
        try:
            await delete_file(voice_path)
        except Exception:
            logger.exception("Failed to roll back object after duplicate name path=%s", voice_path)
        raise VoiceException(status_code=409, detail=str(e)) from e
    except VoiceException:
        try:
            await delete_file(voice_path)
        except Exception:
            logger.exception("Failed to roll back object after DB error path=%s", voice_path)
        raise
    except Exception:
        try:
            await delete_file(voice_path)
        except Exception:
            logger.exception("Failed to roll back object after DB error path=%s", voice_path)
        logger.exception("Failed to create voice meta user_id=%s", user_id)
        raise VoiceException(status_code=500, detail="Failed to create voice") from None

    created = VoiceCreated.model_validate(voice_meta)
    if body.example_text and body.example_text.strip():
        wav_bytes = await tts_synthesize(
            text=body.example_text.strip(),
            ref_audio_bytes=audio_bytes,
            ref_text=voice_content,
        )
        created.example_data = (
            base64.b64encode(wav_bytes).decode("utf-8") if wav_bytes is not None else None
        )
    logger.info("Voice created user_id=%s id=%s", user_id, created.id)
    return created
