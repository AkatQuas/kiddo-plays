from fastapi.testclient import TestClient


def test_health():
    from clip_embed.main import app

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
