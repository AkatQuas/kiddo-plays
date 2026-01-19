from typing import Annotated

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import HTMLResponse


def register_file(app: FastAPI):
    @app.post("/files/")
    async def create_file(
        file: Annotated[bytes | None, File(description="A file read as bytes")] = None,
    ):
        if not file:
            return {"message": "No file"}
        else:
            return {"file_size": len(file)}

    @app.post("/uploadfile/")
    async def create_upload_file(
        file: (
            Annotated[UploadFile, File(description="A file read as UploadFile")] | None
        ) = None,
    ):
        if not file:
            return {"message": "No file"}
        else:
            return {"filename": file.filename}

    @app.post("/files/")
    async def create_files(files: Annotated[list[bytes], File()]):
        return {"file_sizes": [len(file) for file in files]}

    @app.post("/uploadfiles/")
    async def create_upload_files(files: list[UploadFile]):
        return {"filenames": [file.filename for file in files]}

    @app.get("/files/")
    async def main():
        content = """
    <body>
    <form action="/files/" enctype="multipart/form-data" method="post">
    <input name="files" type="file" multiple>
    <input type="submit">
    </form>
    <form action="/uploadfiles/" enctype="multipart/form-data" method="post">
    <input name="files" type="file" multiple>
    <input type="submit">
    </form>
    </body>
        """
        return HTMLResponse(content=content)
