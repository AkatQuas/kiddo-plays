"""HTTP front for submit and poll. The worker loop lives in the Scheduler."""

from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from imgrelay.constants import BIND_HOST, BIND_PORT, DEFAULT_CFG_SCALE, DEFAULT_STEPS
from imgrelay.jobs import JobBoard, JobRecord, JobSpec
from imgrelay.runtime import build_runtime
from imgrelay.scheduler import Scheduler

class CreateJobRequest(BaseModel):
    prompt: str
    input_image: str
    negative_prompt: str = ""
    width: int | None = None
    height: int | None = None
    steps: int = Field(default=DEFAULT_STEPS, ge=1)
    cfg_scale: float = DEFAULT_CFG_SCALE
    seed: int | None = None

    def to_spec(self) -> JobSpec:
        parsed = urlparse(self.input_image)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("input_image must be an http(s) URL the engine can fetch")
        return JobSpec(
            prompt=self.prompt,
            input_image=self.input_image,
            negative_prompt=self.negative_prompt,
            width=self.width,
            height=self.height,
            steps=self.steps,
            cfg_scale=self.cfg_scale,
            seed=self.seed,
        )


class JobResponse(BaseModel):
    job_id: str
    status: str
    attempts: int = 0
    result_ref: str | None = None
    error: str | None = None


def _view(record: JobRecord) -> JobResponse:
    return JobResponse(
        job_id=record.job_id,
        status=record.status,
        attempts=record.attempts,
        result_ref=record.result_ref,
        error=record.error,
    )


def create_app(board: JobBoard, scheduler: Scheduler | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        worker = app.state.scheduler
        if worker is not None:
            worker.start()
        try:
            yield
        finally:
            if worker is not None:
                worker.stop()

    app = FastAPI(title="imgrelay", version="0.1.0", lifespan=lifespan)
    app.state.board = board
    app.state.scheduler = scheduler

    @app.post("/v1/jobs", response_model=JobResponse)
    def create_job(body: CreateJobRequest, request: Request) -> JobResponse:
        try:
            spec = body.to_spec()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        job_id = request.app.state.board.submit(spec)
        record = request.app.state.board.get(job_id)
        if record is None:
            raise HTTPException(status_code=500, detail="job disappeared after submit")
        return _view(record)

    @app.get("/v1/jobs/{job_id}", response_model=JobResponse)
    def read_job(job_id: str, request: Request) -> JobResponse:
        record = request.app.state.board.get(job_id)
        if record is None:
            raise HTTPException(status_code=404, detail="job not found")
        return _view(record)

    @app.get("/v1/health")
    def health(request: Request) -> dict:
        board_ok = request.app.state.board.ping()
        return {"status": "ok" if board_ok else "degraded", "queue": board_ok}

    return app


def main() -> None:
    import logging

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    scheduler = build_runtime()
    app = create_app(scheduler.board, scheduler)
    uvicorn.run(app, host=BIND_HOST, port=BIND_PORT)


if __name__ == "__main__":
    main()
