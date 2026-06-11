from datetime import UTC, datetime

from fastapi import APIRouter, Query

from app.database import get_db
from app.schemas import ApiResponse, FileBindData, FileBindRequest, FileListItem

router = APIRouter(prefix="/api/file", tags=["file"])


@router.post("/bind")
async def bind_file(body: FileBindRequest) -> ApiResponse:
    doc = {
        "username": body.username.strip(),
        "file_name": body.file_name,
        "file_key": body.file_key,
        "file_url": body.file_url,
        "file_size": body.file_size,
        "mime_type": body.mime_type,
        "create_time": datetime.now(UTC),
    }
    result = await get_db().file_user_relation.insert_one(doc)
    return ApiResponse(
        code=200,
        msg="文件绑定成功",
        data=FileBindData(id=str(result.inserted_id), username=doc["username"]).model_dump(),
    )


@router.get("/list")
async def list_files(username: str = Query(min_length=1)) -> ApiResponse:
    cursor = get_db().file_user_relation.find({"username": username.strip()}).sort(
        "create_time", -1
    )
    items: list[dict] = []
    async for doc in cursor:
        items.append(
            FileListItem(
                id=str(doc["_id"]),
                username=doc["username"],
                file_name=doc["file_name"],
                file_key=doc["file_key"],
                file_url=doc["file_url"],
                file_size=doc["file_size"],
                mime_type=doc.get("mime_type"),
                create_time=doc["create_time"],
            ).model_dump(mode="json")
        )
    return ApiResponse(code=200, msg="查询成功", data=items)
