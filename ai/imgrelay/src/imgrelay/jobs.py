"""Job records and the JobBoard seam.

A JobBoard is the only queue. Production uses Redis so every pod shares one
waiting line. Callers never see lists, locks, or leases.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from imgrelay.constants import DEFAULT_CFG_SCALE, DEFAULT_STEPS

WAITING = "waiting"
RUNNING = "running"
FINISHED = "finished"
FAILED = "failed"


@dataclass(frozen=True)
class JobSpec:
    """What the caller asked the engine to do. Immutable after submit."""

    prompt: str
    input_image: str
    negative_prompt: str = ""
    width: int | None = None
    height: int | None = None
    steps: int = DEFAULT_STEPS
    cfg_scale: float = DEFAULT_CFG_SCALE
    seed: int | None = None


@dataclass
class JobRecord:
    """One queued image job, including attempts and the result reference."""

    job_id: str
    spec: JobSpec
    status: str
    attempts: int = 0
    error: str | None = None
    result_ref: str | None = None


class JobBoard(Protocol):
    """Distributed waiting line plus job state.

    Invariants:
    - ``submit`` is FCFS: a later submit is claimed after earlier ones,
      except a retried job, which goes to the tail.
    - ``claim`` returns a job to exactly one caller and hides lease expiry.
      A job left running longer than the visibility window is retried or
      failed by the board before the next claim returns.
    - ``ack``, ``retry``, and ``fail`` are only valid for a claimed job.
    - ``get`` is safe on any pod and returns ``None`` when the id is unknown.
    - ``claim`` returns ``None`` when nothing is waiting. ``block_seconds``
      is how long the caller is willing to wait.
    """

    def submit(self, spec: JobSpec) -> str: ...

    def get(self, job_id: str) -> JobRecord | None: ...

    def claim(self, block_seconds: int) -> JobRecord | None: ...

    def ack(self, job_id: str, result_ref: str) -> None: ...

    def retry(self, job_id: str, error: str) -> None: ...

    def fail(self, job_id: str, error: str) -> None: ...

    def ping(self) -> bool: ...
