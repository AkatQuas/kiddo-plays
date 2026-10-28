from pathlib import Path

import httpx

from imgrelay.engine import EngineError, HttpImageEngine
from imgrelay.jobs import JobRecord, JobSpec
from imgrelay.storage import LocalStore

PNG = b"\x89PNG\r\n"


def _job() -> JobRecord:
    return JobRecord(
        job_id="j1",
        spec=JobSpec(prompt="forest", input_image="https://example.test/a.jpg", steps=4),
        status="running",
    )


def test_http_engine_posts_the_contract_and_returns_bytes():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["body"] = request.read()
        return httpx.Response(200, content=PNG, headers={"content-type": "image/png"})

    engine = HttpImageEngine("http://engine.internal", client=httpx.Client(transport=httpx.MockTransport(handler)))
    body, content_type = engine.edit(_job())
    assert body == PNG
    assert content_type == "image/png"
    assert seen["path"] == "/v1/images/edits"
    assert b"forest" in seen["body"]


def test_http_engine_raises_on_error_status():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="busy")

    engine = HttpImageEngine("http://engine.internal", client=httpx.Client(transport=httpx.MockTransport(handler)))
    try:
        engine.edit(_job())
    except EngineError as exc:
        assert "503" in str(exc)
    else:
        raise AssertionError("expected EngineError")


def test_local_store_writes_inside_the_root(tmp_path: Path):
    store = LocalStore(str(tmp_path))
    ref = store.put("jobs/abc.png", PNG, "image/png")
    path = Path(ref)
    assert path == (tmp_path / "jobs" / "abc.png").resolve()
    assert path.read_bytes() == PNG
