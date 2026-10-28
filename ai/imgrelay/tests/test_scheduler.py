from imgrelay.constants import MAX_ATTEMPTS
from imgrelay.engine import EngineError
from imgrelay.jobs import FAILED, FINISHED, JobSpec
from imgrelay.scheduler import Scheduler

from tests.fakes import MemoryJobBoard, MemoryStore, ScriptedEngine

PNG = b"\x89PNG\r\n"


def _spec(prompt: str) -> JobSpec:
    return JobSpec(prompt=prompt, input_image="https://example.test/in.png")


def test_run_once_publishes_and_acks_in_order():
    board = MemoryJobBoard()
    first = board.submit(_spec("one"))
    second = board.submit(_spec("two"))
    engine = ScriptedEngine([b"aaa", b"bbb"])
    store = MemoryStore()
    scheduler = Scheduler(board, engine, store)

    assert scheduler.run_once(block_seconds=0) is True
    assert scheduler.run_once(block_seconds=0) is True
    assert scheduler.run_once(block_seconds=0) is False

    assert engine.seen == ["one", "two"]
    assert board.get(first).status == FINISHED
    assert board.get(second).status == FINISHED
    assert board.get(first).result_ref == f"mem://jobs/{first}.png"
    assert store.objects[f"jobs/{first}.png"] == b"aaa"


def test_retries_then_fails_at_max_attempts():
    board = MemoryJobBoard()
    job_id = board.submit(_spec("boom"))
    engine = ScriptedEngine([EngineError("nope")] * MAX_ATTEMPTS)
    scheduler = Scheduler(board, engine, MemoryStore())

    for _ in range(MAX_ATTEMPTS):
        assert scheduler.run_once(block_seconds=0) is True

    record = board.get(job_id)
    assert record.status == FAILED
    assert record.attempts == MAX_ATTEMPTS
    assert record.error == "nope"
    assert scheduler.run_once(block_seconds=0) is False


def test_retry_then_success_keeps_the_image():
    board = MemoryJobBoard()
    job_id = board.submit(_spec("later"))
    engine = ScriptedEngine([EngineError("flaky"), PNG])
    store = MemoryStore()
    scheduler = Scheduler(board, engine, store)

    scheduler.run_once(block_seconds=0)
    assert board.get(job_id).status == "waiting"
    scheduler.run_once(block_seconds=0)

    record = board.get(job_id)
    assert record.status == FINISHED
    assert record.attempts == 1
    assert store.objects[f"jobs/{job_id}.png"] == PNG
