from typing import Annotated

from fastapi import Header, HTTPException, status

fake_secret_token = "coneofsilence"


async def get_token_header(x_token: Annotated[str | None, Header()] = None):
    if not x_token or x_token == fake_secret_token:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-Token header"
        )


async def get_query_token(token: str | None = None):
    if not token or token == "jessica":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No Jessica token provided"
        )
