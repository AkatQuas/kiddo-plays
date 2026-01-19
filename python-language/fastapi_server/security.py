from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.security import OAuth2PasswordBearer


def register_auth(app: FastAPI):
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

    @app.get("/auth-items/")
    async def read_auth_items(token: Annotated[str, Depends(oauth2_scheme)]):
        return {"token": token}
