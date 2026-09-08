from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ErrorResponse(BaseModel):
    error: str
    request_id: str = ""
    detail: object | None = None


class VoiceCreate(BaseModel):
    voice_name: str = Field(min_length=1, max_length=100)
    audio_data: str = Field(description="Base64-encoded audio, optional data-URI prefix")
    audio_content: str | None = None
    example_text: str | None = None


class VoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voice_name: str
    voice_content: str
    voice_path: str
    created_at: datetime | None = None


class VoiceCreated(VoiceRead):
    example_data: str | None = None


class VoicePage(BaseModel):
    items: list[VoiceRead]
    offset: int
    limit: int
    total: int
