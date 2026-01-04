import pytest
from flask import Flask, g, session
from flask.testing import FlaskClient

from flaskr.db import get_db
from tests.conftest import AuthActions


def test_register(client: FlaskClient, app: Flask):
    assert client.get("/auth/register").status_code == 200

    response = client.post(
        "/auth/register", data={"username": "admin", "password": "123"}
    )
    assert response.headers["Location"] == "/auth/login"

    with app.app_context():
        assert (
            get_db().execute("SELECT * FROM user WHERE username = 'admin'").fetchone()
            is not None
        )


@pytest.mark.parametrize(
    ("username", "password", "message"),
    (
        ("", "", b"Username is required"),
        ("a", "", b"Password is required"),
        ("test", "test", b"already registered"),
    ),
)
def test_register_validate_input(
    client: FlaskClient, username: str, password: str, message: str
):
    response = client.post(
        "/auth/register", data={"username": username, "password": password}
    )

    assert message in response.data


@pytest.mark.parametrize(
    ("username", "password", "message"),
    (("", "", b"Username is required"), ("jojo", "", b"User jojo not exist")),
)
def test_change_password_valid_input(
    client: FlaskClient, username: str, password: str, message: str
):
    response = client.post(
        "/auth/change_pwd", json={"username": username, "password": password}
    )

    assert message in response.data


def test_change_password(client: FlaskClient, auth: "AuthActions"):
    response = auth.change_password()
    assert response.headers["Location"] == "/auth/login"

    response = auth.login("test_change", password="abc")
    assert response.headers["Location"] == "/"


def test_login(client: FlaskClient, auth: "AuthActions"):
    assert client.get("/auth/login").status_code == 200
    response = auth.login()
    assert response.headers["Location"] == "/"

    with client:
        client.get("/")
        assert session["user_id"] == 1
        assert g.user["username"] == "test"


@pytest.mark.parametrize(
    ("username", "password", "message"),
    (
        ("a", "test", b"Incorrect username"),
        ("test", "a", b"Incorrect password"),
    ),
)
def test_login_validate_input(
    auth: "AuthActions", username: str, password: str, message: str
):
    response = auth.login(username, password)
    assert message in response.data


def test_logout(client: FlaskClient, auth: AuthActions):
    auth.login()
    with client:
        auth.logout()
        assert "user_id" not in session
