from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles

from .dependencies import get_query_token, get_token_header
from .internal import admin
from .routers import books, users

tags_metadata = [
    {
        "name": "users",
        "description": "Operations with users. The **login** logic is also here.",
    },
    {
        "name": "books",
        "description": "Manage books. So _fancy_ they have their own docs.",
        "externalDocs": {
            "description": "Books external docs",
            "url": "https://fastapi.tiangolo.com/",
        },
    },
]

app = FastAPI(dependencies=[Depends(get_query_token)], openapi_tags=tags_metadata)


# static is relative to process working directory
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(users.router)
app.include_router(books.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "Hello Bigger Applications!"}
