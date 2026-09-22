from io import BytesIO

from fastapi import UploadFile
from PIL import Image


async def read_upload_image(file: UploadFile) -> Image.Image:
    contents = await file.read()
    return Image.open(BytesIO(contents)).convert("RGB")
