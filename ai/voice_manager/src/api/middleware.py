import time
from collections.abc import Callable

from fastapi import Request, Response

from common.log import logger
from common.request_context import generate_request_id, request_id_context, set_request_id


def setup_middleware(app) -> None:
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or generate_request_id()
        token = set_request_id(request_id)
        request.state.request_id = request_id
        start_time = time.perf_counter()
        logger.info("request start method=%s path=%s", request.method, request.url.path)
        try:
            response = await call_next(request)
        except Exception:
            request_id_context.reset(token)
            raise
        request_id_context.reset(token)

        elapsed = time.perf_counter() - start_time
        logger.info(
            "request done method=%s path=%s status=%s time=%.3fs",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{elapsed:.3f}"
        return response
