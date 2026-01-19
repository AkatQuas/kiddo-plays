from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, status


async def common_parameters(q: str | None = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}


Commons = Annotated[dict, Depends(common_parameters)]


def query_extractor(q: str | None = None):
    return q


def query_or_cookie_extractor(
    q: Annotated[str, Depends(query_extractor)],
    last_query: Annotated[str | None, Cookie()] = None,
):
    if not q:
        return last_query
    return q


class CommonQueryParams:
    def __init__(self, q: str | None = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit


def register_di(app: FastAPI):
    @app.get("/common-items/")
    async def read_common_items(commons: Commons):
        return commons

    @app.get("/common-users/")
    async def read_common_users(commons: Commons):
        return commons

    @app.get("/common-class-items/")
    async def read_common_class_items(commons: Annotated[CommonQueryParams, Depends()]):
        response = {}
        if commons.q:
            response.update({"q": commons.q})
        return response

    @app.get("/query-items/")
    async def read_query_item(
        query_or_default: Annotated[str, Depends(query_or_cookie_extractor)],
    ):
        return {"q_or_cookie": query_or_default}

    async def verify_token(x_token: Annotated[str, Header()]):
        if x_token != "fake-super-secret-token":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="X-Token header invalid"
            )

    async def verify_key(x_key: Annotated[str, Header()]):
        if x_key != "fake-super-secret-key":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="X-Key header invalid"
            )
        return x_key

    @app.get(
        "/header-check-items/",
        dependencies=[Depends(verify_token), Depends(verify_key)],
    )
    async def header_check_items():
        return []
