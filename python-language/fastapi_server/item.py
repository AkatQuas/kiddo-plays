from datetime import datetime
from typing import Union

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class BaseItem(BaseModel):
    description: str
    timestamp: datetime
    type: str


class CarItem(BaseItem):
    type: str = "car"


class PlaneItem(BaseItem):
    type: str = "plane"
    size: int


items = {
    "item1": {"description": "All my friends drive a low rider", "type": "car"},
    "item2": {
        "description": "Music is my aeroplane, it's my aeroplane",
        "type": "plane",
        "size": 5,
    },
}


class UnicornException(Exception):
    def __init__(self, name: str):
        self.name = name


def register_items(app: FastAPI):
    @app.get("/typed-items/{item_id}/", response_model=Union[PlaneItem, CarItem])
    async def read_item(item_id: str):
        if item_id not in items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found",
                headers={"X-Error": "Something wrong"},
            )
        return items[item_id]

    @app.exception_handler(UnicornException)
    async def unicorn_exception_handler(request: Request, exc: UnicornException):
        return JSONResponse(
            status_code=418,
            content={
                "message": f"Oops! {exc.name} did something. There goes a rainbow..."
            },
        )

    @app.get("/unicorns/{name}/")
    async def read_unicorn(name: str):
        if name == "yolo":
            raise UnicornException(name=name)
        return {"unicorn_name": name}

    fake_db = {}

    @app.put("/typed-items/{id}/")
    def update_item(id: str, item: BaseItem):
        # convert datetime to database acceptable
        json_compatible = jsonable_encoder(item)
        fake_db[id] = json_compatible
