# -*- coding: utf-8 -*-
from __future__ import annotations

import time

from fastapi import Depends, FastAPI, HTTPException
from loguru import logger

from agent_websearch import __version__
from agent_websearch.auth import verify_token
from agent_websearch.parsers import parse_amazon_list, parse_amazon_product
from agent_websearch.search.orchestrator import SearchOrchestrator
from agent_websearch.search.schema import (
    ParseAmazonListRequest,
    ParseAmazonProductRequest,
    PresignRequest,
    SearchRequest,
    make_response,
)
from agent_websearch.settings import get_settings
from agent_websearch.storage import S3Storage

app = FastAPI(
    title="agent-websearch",
    version=__version__,
    description="Official search API orchestration, HTML parsers, S3-compatible storage",
)


@app.get("/health")
async def health():
    settings = get_settings()
    orch = SearchOrchestrator(settings)
    storage = S3Storage(settings)
    return {
        "status": "ok",
        "version": __version__,
        "providers": orch.available_providers(),
        "s3_configured": storage.configured(),
    }


@app.post("/v1/search", dependencies=[Depends(verify_token)])
async def search(request: SearchRequest):
    started = time.time()
    logger.info(f"search query_len={len(request.query)} source={request.source}")
    orch = SearchOrchestrator()
    return await orch.run(
        query=request.query,
        source=request.source,
        max_results=request.max_results,
        started_at=started,
    )


@app.post("/v1/parse/amazon/product", dependencies=[Depends(verify_token)])
async def parse_product(request: ParseAmazonProductRequest):
    started = time.time()
    try:
        result = parse_amazon_product(request.html, asin=request.asin)
    except Exception as exc:
        logger.error(f"parse product failed: {exc}")
        return make_response(
            result=None,
            status="fail",
            status_msg=str(exc),
            started_at=started,
        )
    return make_response(result=result, status="success", started_at=started)


@app.post("/v1/parse/amazon/list", dependencies=[Depends(verify_token)])
async def parse_list(request: ParseAmazonListRequest):
    started = time.time()
    try:
        result = parse_amazon_list(request.html, url=request.url)
    except Exception as exc:
        logger.error(f"parse list failed: {exc}")
        return make_response(
            result=None,
            status="fail",
            status_msg=str(exc),
            started_at=started,
        )
    return make_response(result=result, status="success", started_at=started)


@app.post("/v1/storage/presign", dependencies=[Depends(verify_token)])
async def storage_presign(request: PresignRequest):
    started = time.time()
    storage = S3Storage()
    if not storage.configured():
        raise HTTPException(status_code=503, detail="S3 is not configured")
    try:
        url = storage.generate_presigned_url(
            request.object_key,
            expires_in=request.expires_in,
            method=request.method,
        )
    except Exception as exc:
        logger.error(f"presign failed: {exc}")
        return make_response(
            result=None,
            status="fail",
            status_msg=str(exc),
            started_at=started,
        )
    return make_response(
        result={"url": url, "bucket": storage.bucket, "object_key": request.object_key},
        status="success",
        started_at=started,
    )


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "agent_websearch.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
