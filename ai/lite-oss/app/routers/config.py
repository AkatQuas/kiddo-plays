from fastapi import APIRouter

from app.config import settings
from app.schemas import ApiResponse

router = APIRouter(prefix="/api", tags=["config"])


@router.get("/config")
async def get_config() -> ApiResponse:
    return ApiResponse(
        code=200,
        msg="ok",
        data={
            "minio_endpoint": settings.minio_endpoint,
            "minio_bucket": settings.minio_bucket,
        },
    )
