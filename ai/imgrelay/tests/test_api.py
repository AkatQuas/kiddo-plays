from fastapi.testclient import TestClient

from imgrelay.api import create_app

from tests.fakes import MemoryJobBoard


def test_submit_and_poll():
    app = create_app(MemoryJobBoard())
    client = TestClient(app)
    created = client.post(
        "/v1/jobs",
        json={"prompt": "forest", "input_image": "https://example.test/a.jpg", "steps": 4},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["status"] == "waiting"
    polled = client.get(f"/v1/jobs/{body['job_id']}")
    assert polled.status_code == 200
    assert polled.json()["job_id"] == body["job_id"]


def test_rejects_non_url_input():
    app = create_app(MemoryJobBoard())
    client = TestClient(app)
    response = client.post(
        "/v1/jobs",
        json={"prompt": "forest", "input_image": "/tmp/local.png"},
    )
    assert response.status_code == 422


def test_missing_job():
    client = TestClient(create_app(MemoryJobBoard()))
    assert client.get("/v1/jobs/missing").status_code == 404


def test_health():
    client = TestClient(create_app(MemoryJobBoard()))
    assert client.get("/v1/health").json()["status"] == "ok"
