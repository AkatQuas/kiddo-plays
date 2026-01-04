import pytest
from flask import Flask
from flask.testing import FlaskClient

from flaskr.db import get_db
from tests.conftest import AuthActions


def test_index(client: FlaskClient, auth: "AuthActions"):
    response = client.get("/")
    assert b"Log In" in response.data
    assert b"Register" in response.data

    auth.login()
    response = client.get("/")
    assert b"Log Out" in response.data
    assert b"test title" in response.data
    assert b"by test on 2026-01-01" in response.data
    assert b"test\nbody" in response.data
    assert b'href="/1/update"' in response.data


@pytest.mark.parametrize(
    "path",
    (
        "/create",
        "/1/update",
        "/1/delete",
    ),
)
def test_login_required(client: FlaskClient, path: str):
    response = client.post(path)
    assert response.headers["Location"] == "/auth/login"


def test_author_required(app: Flask, client: FlaskClient, auth: "AuthActions"):
    with app.app_context():
        db = get_db()
        db.execute("UPDATE post SET author_id = 2 WHERE id = 1")
        db.commit()

    auth.login()
    assert client.post("/1/update").status_code == 403
    assert client.post("/1/delete").status_code == 403
    assert b'href="/1/update"' not in client.get("/").data


@pytest.mark.parametrize("path", ("/2/update", "/2/delete"))
def test_exists_required(client: FlaskClient, auth: "AuthActions", path: str):
    auth.login()
    assert client.post(path).status_code == 404


def test_create(client: FlaskClient, auth: "AuthActions", app):
    auth.login()
    assert client.get("/create").status_code == 200
    client.post("/create", data={"title": "created", "body": ""})

    with app.app_context():
        db = get_db()
        count = db.execute("SELECT COUNT(id) FROM post").fetchone()[0]
        assert count == 2


def test_update(client: FlaskClient, auth: "AuthActions", app: Flask):
    auth.login()
    assert client.get("/1/update").status_code == 200
    client.post("/1/update", data={"title": "updated", "body": ""})

    with app.app_context():
        db = get_db()
        post = db.execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post["title"] == "updated"


@pytest.mark.parametrize(
    "path",
    (
        "/create",
        "/1/update",
    ),
)
def test_create_update_validate(client: FlaskClient, auth: "AuthActions", path: str):
    auth.login()
    response = client.post(path, data={"title": "", "body": ""})
    assert b"Title is required" in response.data


def test_delete(client: FlaskClient, auth: "AuthActions", app: Flask):
    auth.login()
    response = client.post("/1/delete")
    assert response.headers["Location"] == "/"

    with app.app_context():
        db = get_db()
        post = db.execute("SELECT * FROM post WHERE id = 1").fetchone()
        assert post is None
