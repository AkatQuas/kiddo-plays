from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.errors import register_exception_handlers
from api.middleware import setup_middleware
from api.routers import health, voices
from common.log import logger
from http_client import close_http_client, init_http_client

OPENAPI_TAGS = [
    {"name": "health", "description": "Liveness probe"},
    {"name": "voices", "description": "Current user's private voices"},
    {"name": "public-voices", "description": "Shared public voice catalog"},
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Voice Manager API application...")
    await init_http_client()
    yield
    logger.info("Shutting down Voice Manager API application...")
    await close_http_client()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Voice Manager API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS,
    )
    setup_middleware(app)
    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(voices.private_router, prefix="/v1")
    app.include_router(voices.public_router, prefix="/v1")
    return app
