from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from api.deps import AdminUid, CurrentUid, DbDep
from schemas.voice import VoiceCreate, VoiceCreated, VoicePage, VoiceRead
from services import voices as voice_service

VoiceId = Annotated[int, Path(ge=1)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]

private_router = APIRouter(prefix="/voices", tags=["voices"])
public_router = APIRouter(prefix="/public/voices", tags=["public-voices"])


@private_router.get("", response_model=VoicePage)
async def list_private_voices(
    db: DbDep,
    uid: CurrentUid,
    offset: Offset = 0,
    limit: Limit = 50,
) -> VoicePage:
    return await voice_service.list_voices(db, uid, is_public=False, offset=offset, limit=limit)


@private_router.post(
    "",
    response_model=VoiceCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_private_voice(
    body: VoiceCreate,
    db: DbDep,
    uid: CurrentUid,
    response: Response,
) -> VoiceCreated:
    created = await voice_service.create_voice(db, uid, body, is_public=False)
    response.headers["Location"] = f"/v1/voices/{created.id}"
    return created


@private_router.get("/{voice_id}", response_model=VoiceRead)
async def get_private_voice(voice_id: VoiceId, db: DbDep, uid: CurrentUid) -> VoiceRead:
    return await voice_service.get_voice(db, voice_id, uid, is_public=False)


@private_router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_private_voice(voice_id: VoiceId, db: DbDep, uid: CurrentUid) -> None:
    await voice_service.delete_voice(db, voice_id, uid, is_public=False)


@public_router.get("", response_model=VoicePage)
async def list_public_voices(
    db: DbDep,
    uid: CurrentUid,
    offset: Offset = 0,
    limit: Limit = 50,
) -> VoicePage:
    return await voice_service.list_voices(db, uid, is_public=True, offset=offset, limit=limit)


@public_router.post(
    "",
    response_model=VoiceCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_voice(
    body: VoiceCreate,
    db: DbDep,
    uid: AdminUid,
    response: Response,
) -> VoiceCreated:
    created = await voice_service.create_voice(db, uid, body, is_public=True)
    response.headers["Location"] = f"/v1/public/voices/{created.id}"
    return created


@public_router.get("/{voice_id}", response_model=VoiceRead)
async def get_public_voice(voice_id: VoiceId, db: DbDep, uid: CurrentUid) -> VoiceRead:
    return await voice_service.get_voice(db, voice_id, uid, is_public=True)


@public_router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_public_voice(voice_id: VoiceId, db: DbDep, uid: AdminUid) -> None:
    await voice_service.delete_voice(db, voice_id, uid, is_public=True)
