import contextvars
import time
import uuid

request_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)
uid_context: contextvars.ContextVar[str | None] = contextvars.ContextVar("uid", default=None)


def generate_request_id() -> str:
    return f"{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"


def set_request_id(request_id: str):
    return request_id_context.set(request_id)


def get_request_id() -> str | None:
    return request_id_context.get()


def set_uid(uid: str):
    return uid_context.set(uid)


def get_uid() -> str | None:
    return uid_context.get()
