import time

import fakeredis

from imgrelay.jobs import FAILED, FINISHED, RUNNING, WAITING, JobSpec
from imgrelay.redis_board import RedisJobBoard


def _board(**kwargs) -> RedisJobBoard:
    client = fakeredis.FakeRedis(decode_responses=True)
    kwargs.setdefault("visibility_seconds", 60)
    return RedisJobBoard(client=client, **kwargs)


def _spec(prompt: str) -> JobSpec:
    return JobSpec(prompt=prompt, input_image="https://example.test/in.png", seed=3)


def test_fifo_claim_ack():
    board = _board()
    first = board.submit(_spec("one"))
    second = board.submit(_spec("two"))
    claimed = board.claim(0)
    assert claimed is not None
    assert claimed.job_id == first
    assert claimed.status == RUNNING
    assert claimed.spec.seed == 3
    board.ack(first, "s3://done")
    assert board.get(first).status == FINISHED
    assert board.get(first).result_ref == "s3://done"
    assert board.claim(0).job_id == second


def test_retry_goes_to_the_tail():
    board = _board()
    first = board.submit(_spec("one"))
    second = board.submit(_spec("two"))
    board.claim(0)
    board.retry(first, "later")
    assert board.get(first).status == WAITING
    assert board.get(first).attempts == 1
    assert board.claim(0).job_id == second
    assert board.claim(0).job_id == first


def test_expired_lease_is_requeued_then_failed():
    board = _board(visibility_seconds=0, max_attempts=2)
    job_id = board.submit(_spec("slow"))
    assert board.claim(0).job_id == job_id
    # visibility 0: the next claim reaps the inflight job before taking new work
    time.sleep(0.01)
    reclaimed = board.claim(0)
    assert reclaimed.job_id == job_id
    assert reclaimed.attempts == 1
    time.sleep(0.01)
    assert board.claim(0) is None
    failed = board.get(job_id)
    assert failed.status == FAILED
    assert failed.error == "claim expired"
    assert failed.attempts == 2
