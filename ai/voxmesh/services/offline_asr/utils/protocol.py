from typing import List

from pydantic import BaseModel


class AsrResponse(BaseModel):
    msg: str = ""
    code: int = 0
    data: dict = {}


class AsyncRequest(BaseModel):
    filekey: str = ""
    filePath: str = ""
    hotword: List[str] = []
    speakers: List[dict] = []
    spk_num: int = 0
    lang: str = "zh"
