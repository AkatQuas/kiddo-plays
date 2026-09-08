from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from common.config import get_server_config
from common.request_context import set_uid
from voice_model import VoiceMetaModel, get_db


def get_db_dep() -> VoiceMetaModel:
    return get_db()


async def get_current_uid(
    x_uid: Annotated[str | None, Header(alias="X-UID")] = None,
) -> str:
    uid = (x_uid or "").strip()
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-UID",
        )
    if len(uid) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-UID is too long",
        )
    set_uid(uid)
    return uid


async def require_admin(uid: Annotated[str, Depends(get_current_uid)]) -> str:
    if uid not in get_server_config().admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
    return uid


DbDep = Annotated[VoiceMetaModel, Depends(get_db_dep)]
CurrentUid = Annotated[str, Depends(get_current_uid)]
AdminUid = Annotated[str, Depends(require_admin)]
