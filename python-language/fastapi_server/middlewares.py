import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware


def register_middleware(app: FastAPI):
    origins = ["http://localhost", "http://localhost:3000"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_time_header(request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = time.perf_counter() - start_time
        response.headers["x-process-time"] = str(process_time)
        return response
