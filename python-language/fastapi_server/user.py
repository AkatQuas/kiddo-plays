from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, Form
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr


class LoginForm(BaseModel):
    username: str
    password: str
    model_config = {"extra": "forbid"}


class UserBase(BaseModel):
    username: str
    email: EmailStr
    fullname: str | None = None
    disabled: bool = False


class UserIn(UserBase):
    password: str


class UserOut(UserBase):
    pass


class UserInDB(UserBase):
    hashed_password: str


def fake_password_hasher(raw_password: str):
    return "supersecret" + raw_password


def fake_save_user(user_in: UserIn):
    hashed_password = fake_password_hasher(user_in.password)
    user_in_db = UserInDB(**user_in.model_dump(), hashed_password=hashed_password)
    return user_in_db


def fake_decode_token(token: str):
    return UserOut(
        username=token + "fake_decoded", email="user@app.com", fullname="fullname"
    )


fake_users_db = {
    "johndoe": {
        "username": "johndoe",
        "fullname": "John Doe",
        "email": "johndoe@example.com",
        "hashed_password": "supersecret123",
        "disabled": False,
    },
    "alice": {
        "username": "alice",
        "fullname": "Alice Wonderson",
        "email": "alice@example.com",
        "hashed_password": "supersecret123",
        "disabled": True,
    },
}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    user = fake_decode_token(token)
    return user


def register_user(app: FastAPI):
    @app.post("/login/")
    async def login(username: Annotated[str, Form()], password: Annotated[str, Form()]):
        return {"username": username}

    @app.post("/login-form/")
    async def login_form(data: Annotated[LoginForm, Form()]):
        return data

    @app.post("/user/", response_model=UserOut)
    async def create_user(user_in: UserIn):
        user_saved = fake_save_user(user_in)
        return user_saved

    @app.get("/users/me/")
    async def get_current_me(
        current_user: Annotated[UserOut, Depends(get_current_user)],
    ):
        return current_user
