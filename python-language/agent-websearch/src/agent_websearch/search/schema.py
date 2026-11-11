# -*- coding: utf-8 -*-
from __future__ import annotations

import time
from typing import Any

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query")
    source: str | None = Field(
        default=None,
        description="Force a provider: tinyfish | tavily | serpapi | brave",
    )
    max_results: int = Field(default=10, ge=1, le=50)


class ParseAmazonProductRequest(BaseModel):
    html: str = Field(..., min_length=1)
    asin: str | None = None


class ParseAmazonListRequest(BaseModel):
    html: str = Field(..., min_length=1)
    url: str | None = None


class PresignRequest(BaseModel):
    object_key: str = Field(..., min_length=1)
    expires_in: int = Field(default=3600, ge=60, le=86400)
    method: str = Field(default="get_object", description="get_object | put_object")


class ApiResponse(BaseModel):
    crawled_time: str
    result: Any = None
    status: str
    cost: float
    status_msg: str | None = None
    source: str | None = None


def make_response(
    *,
    result: Any = None,
    status: str = "success",
    status_msg: str | None = None,
    source: str | None = None,
    started_at: float,
) -> dict[str, Any]:
    return {
        "crawled_time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "result": result,
        "status": status,
        "cost": round(time.time() - started_at, 3),
        "status_msg": status_msg,
        "source": source,
    }
