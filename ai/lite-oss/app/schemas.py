from datetime import datetime

from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    code: int
    msg: str
    data: dict | list | None = None


class FileBindRequest(BaseModel):
    username: str = Field(min_length=1)
    file_name: str = Field(min_length=1)
    file_key: str = Field(min_length=1)
    file_url: str = Field(min_length=1)
    file_size: int = Field(ge=0)
    mime_type: str | None = None


class FileBindData(BaseModel):
    id: str
    username: str


class FileListItem(BaseModel):
    id: str
    username: str
    file_name: str
    file_key: str
    file_url: str
    file_size: int
    mime_type: str | None
    create_time: datetime
