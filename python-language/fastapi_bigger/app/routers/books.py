from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, logger
from pydantic import BaseModel

from ..dependencies import get_token_header

router = APIRouter(
    prefix="/books",
    tags=["books"],
    dependencies=[Depends(get_token_header)],
    responses={404: {"description": "Not found"}},
)


class Book(BaseModel):
    id: str
    title: str
    description: str | None = None


fake_books_db = {
    "foo": {"id": "foo", "title": "Foo", "description": "There goes my hero"},
    "bar": {"id": "bar", "title": "Bar", "description": "The bartenders"},
}


@router.get("/")
async def read_books():
    return fake_books_db


@router.get("/{book_id}", response_model=Book)
async def read_book(book_id: str, x_token: Annotated[str, Header()]):
    logger.logger.info(x_token)
    if book_id not in fake_books_db:
        raise HTTPException(status_code=404, detail="Book not found")
    return fake_books_db[book_id]


@router.post("/", response_model=Book)
async def create_book(book: Book, x_token: Annotated[str, Header()]):
    if book.id in fake_books_db:
        raise HTTPException(status_code=409, detail=f"Book {book.id} already exists")
    fake_books_db[book.id] = book
    return book


@router.put(
    "/{book_id}",
    tags=["custom"],
    responses={403: {"description": "Operation forbidden"}},
)
async def update_book(book_id: str):
    if book_id != "foo":
        raise HTTPException(status_code=403, detail="You can only update the book: foo")
    return {"book_id": book_id, "name": "The great foo"}
