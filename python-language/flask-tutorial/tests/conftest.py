import os
import tempfile

import pytest
from flask import Flask
from flask.testing import FlaskClient

from flaskr import create_app
from flaskr.db import get_db, init_db


class AuthActions(object):
    def __init__(self, client: FlaskClient) -> None:
        self._client = client

    def login(self, username="test", password="test"):
        return self._client.post(
            "/auth/login", data={"username": username, "password": password}
        )

    def change_password(self, username="test_change", password="abc"):
        return self._client.post(
            "/auth/change_pwd", json={"username": username, "password": password}
        )

    def logout(self):
        return self._client.get("/auth/logout")


with open(os.path.join(os.path.dirname(__file__), "data.sql"), "rb") as f:
    _data_sql = f.read().decode("utf8")


@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp()

    app = create_app({"TESTING": True, "DATABASE": db_path})

    with app.app_context():
        init_db()
        get_db().executescript(_data_sql)

    yield app

    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app: Flask):
    return app.test_client()


@pytest.fixture
def runner(app: Flask):
    return app.test_cli_runner()


@pytest.fixture
def auth(client: FlaskClient):
    return AuthActions(client)
