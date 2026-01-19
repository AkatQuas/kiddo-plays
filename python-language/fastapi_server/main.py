from datetime import datetime, time, timedelta
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from fastapi import (
    Body,
    Cookie,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Path,
    Query,
    Response,
    logger,
    status,
)
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field, HttpUrl

from .di import register_di
from .file import register_file
from .item import register_items
from .middlewares import register_middleware
from .models import register_models
from .user import register_user


async def verify_global_token(
    x_global_token: Annotated[str | None, Header()] = None,
):
    if x_global_token is None or x_global_token == "fake-global-token":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Global-Token header invalid",
        )


app = FastAPI(dependencies=[Depends(verify_global_token)])


register_middleware(app)
register_di(app)
register_file(app)
register_items(app)
register_models(app)
register_user(app)


class Cookies(BaseModel):
    model_config = {"extra": "forbid"}
    session_id: str
    facebook_tracker: str | None = None
    google_tracker: str | None = None


class CommonHeaders(BaseModel):
    # model_config = {"extra": "forbid"}
    host: str
    save_data: bool
    if_modified_since: str | None = None
    traceparent: str | None = None
    x_tag: list[str] = []


class FilterParams(BaseModel):
    limit: int = Field(100, gt=0, le=100)
    offset: int = Field(0, ge=0)
    order_by: Literal["created_at", "updated_at"] = "created_at"
    tags: list[str] = []


class Image(BaseModel):
    url: HttpUrl
    name: str


class Author(BaseModel):
    username: str
    fullname: str | None = None
    email: EmailStr | None = None

    model_config = {
        "json_schema_extra": {
            "examples": [{"username": "Jacky", "fullname": "Jacky Chen"}]
        }
    }


class Book(BaseModel):
    name: str = Field(examples=["Foo"])
    description: str | None = Field(
        default=None, title="The description of the item", max_length=300
    )
    price: float = Field(gt=0, description="The price must be greater than zero")
    tax: float | None = Field(default=None, examples=[3.2])
    tags: set[str] = set()
    image: Image | None = None
    images: list[Image] | None = None
    author: Author | None = None


class BestSells(BaseModel):
    name: str
    description: str | None = None
    books: list[Book]


class Item(BaseModel):
    name: str
    price: float
    is_offer: Union[bool, None] = None


@app.get("/")
def read_root():
    return {"message": "Hello 42!"}


@app.get("/portal/")
async def get_portal(teleport: bool = False) -> Response:
    if teleport:
        return RedirectResponse(url="https://cn.bing.com")
    return JSONResponse(content={"message": "Here's your portal."})


@app.get("/items/", response_model=list[dict], response_model_exclude_unset=True)
def read_items(
    needy: str,
    filter_query: Annotated[FilterParams, Query()],
    cookies: Annotated[Cookies, Cookie()],
    headers: Annotated[CommonHeaders, Header()],
    ads_id: Annotated[str | None, Cookie()] = None,
    user_agent: Annotated[str | None, Header()] = None,
    q: Annotated[str | None, Query(min_length=3)] = None,
    multi: Annotated[list[str] | None, Query()] = None,
    bad: Annotated[str | None, Query(deprecated=True)] = None,
    short: bool = False,
    hidden_query: Annotated[str | None, Query(include_in_schema=False)] = None,
):
    results: dict[str, Any] = {
        "items": [{"item_id": "Foo"}, {"item_id": "Bar"}],
        "needy_is_required": needy,
    }
    if q:
        results.update({"q": q})
    if multi:
        results.update({"multi": multi})
    results.update(
        {"hidden_query": hidden_query if hidden_query else "not found hidden query"}
    )
    return results


@app.get("/items/{item_id}/")
def read_item(
    item_id: Annotated[int, Path(title="The ID ofe the item", gt=0, le=1000)],
    q: Annotated[str | None, Query(min_length=3, alias="item-query")] = None,
    size: Annotated[float | None, Query(gt=0, lt=10.5)] = None,
    short: bool = False,
):
    item: dict[str, Any] = {"item_id": item_id}
    if q:
        item.update({"q": q})
    if not short:
        item.update(
            {"description": "This is an amazing item that has a long description"}
        )
    return item


@app.get("/users/{user_id}/items/{item_id}/")
async def read_user_item(
    user_id: int,
    item_id: str,
    q: Annotated[str | None, Query(max_length=50)] = None,
    short: bool = False,
):
    item: dict[str, Any] = {"item_id": item_id, "owner_id": user_id}
    if q:
        item.update({"q": q})
    if not short:
        item.update(
            {"description": "This is an amazing item that has a long description"}
        )
    return item


@app.put("/items/{item_id}/")
def update_item(
    item_id: Annotated[int, Path(title="The ID of the item", ge=0, le=1000)],
    author: Annotated[
        Author, Body(examples=[{"username": "Jack", "fullname": "Jack Chow"}])
    ],
    importance: Annotated[int, Body()],
    q: str | None = None,
    item: Item | None = None,
):
    results: dict[str, Any] = {"item_id": item_id, "author": author}
    if q:
        results.update({"q": q})
    if item:
        results.update({"item": item})
    if importance:
        results.update({"importance": importance})
    return results


BookIdList = {
    "isbn-9781529046137": "The Hitchhiker's Guide to the Galaxy",
    "imdb-tt0371724": "The Hitchhiker's Guide to the Galaxy",
    "isbn-9781439512982": "Isaac Asimov: The Complete Stories, Vol. 2",
}


def check_valid_id(id: str):
    if not id.startswith(("isbn-", "imdb-")):
        raise ValueError('Invalid ID format, it must start with "isbn-" or "imdb-"')
    return id


@app.post("/books/", status_code=status.HTTP_201_CREATED)
async def create_book(
    book: Annotated[Book, Body(examples=[{"name": "Foo", "price": 354.4}])],
    start_datetime: Annotated[datetime, Body()],
    end_datetime: Annotated[datetime, Body()],
    process_after: Annotated[timedelta, Body()],
    repeat_at: Annotated[time | None, Body()],
) -> dict:
    book_dict = book.model_dump()
    start_process = start_datetime + process_after
    duration = end_datetime - start_process
    book_dict.update({"start_process": start_process, "duration": duration})
    if book.tax is not None:
        price_with_tax = book.price + book.tax
        book_dict.update({"price_with_tax": price_with_tax})
    return book_dict


@app.put("/books/{book_id}/")
async def update_book(book_id: int, book: Item, q: str | None = None):
    result = {"book_id": book_id, **book.model_dump()}
    if q:
        result.update({"q": q})
    return result


@app.post("/images/multiple/")
async def create_multiple_images(images: list[Image]):
    for image in images:
        image.url
    return images
