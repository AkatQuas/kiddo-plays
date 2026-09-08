from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from common.exceptions import VoiceException
from common.log import logger
from common.request_context import get_request_id
from schemas.voice import ErrorResponse


def _payload(error: str, *, detail=None) -> dict:
    body = ErrorResponse(error=error, request_id=get_request_id() or "", detail=detail)
    return body.model_dump(exclude_none=True)


def register_exception_handlers(app) -> None:
    @app.exception_handler(VoiceException)
    async def voice_exception_handler(request: Request, exc: VoiceException) -> JSONResponse:
        if exc.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.error("VoiceException: %s path=%s", exc, request.url.path)
        else:
            logger.warning("VoiceException: %s path=%s", exc, request.url.path)
        return JSONResponse(status_code=exc.status_code, content=_payload(exc.detail))

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(detail),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content=_payload("Validation error", detail=exc.errors()),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error path=%s", request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_payload("Internal server error"),
        )
