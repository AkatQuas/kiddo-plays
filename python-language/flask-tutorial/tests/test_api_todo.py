import json

import pytest
from flask.testing import FlaskClient


def test_todo_list(client: FlaskClient):
    response = client.get("/api/todos")
    assert response.status_code == 200
    res_data = json.loads(response.data)
    assert len(res_data) == 3


def test_add_to_todo_list(client: FlaskClient):
    client.post("/api/todos", json={"task": "hello"})
    response = client.get("/api/todos")
    res_data = json.loads(response.data)
    assert len(res_data) == 4
    client.post("/api/todos", json={"task": "hello", "due": "2026-01-10 00:00:00"})
    response = client.get("/api/todos")
    res_data = json.loads(response.data)
    assert len(res_data) == 5


def test_todo_item(client: FlaskClient):
    client.put("/api/todos/2", json={"task": "new task"})
    response = client.get("/api/todos/2")
    res_data = json.loads(response.data)
    assert "new task" == res_data["task"]


def test_todo_add_and_remove(client: FlaskClient):
    response = client.get("/api/todos/4")
    assert response.status_code == 404
    assert "4 doesn't exist" in response.text

    client.post("/api/todos", json={"task": "hello4"})
    response = client.get("/api/todos/4")
    res_data = json.loads(response.data)
    assert res_data["task"] == "hello4"

    response = client.delete("/api/todos/4")
    assert response.status_code == 204
