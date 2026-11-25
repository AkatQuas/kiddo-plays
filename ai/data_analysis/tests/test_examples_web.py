"""Tests for built-in examples and REST endpoints."""

from fastapi.testclient import TestClient

from data_analysis import examples
from data_analysis.config import settings
from data_analysis.main import app

settings.API_KEYS = "test-api-key"
client = TestClient(app, headers={"X-API-Key": "test-api-key"})


def test_list_examples_has_both_domains():
    ids = {e["id"] for e in examples.list_examples()}
    assert {"o2c", "dota2"} <= ids


def test_run_o2c_example_in_memory():
    r = examples.run_example("o2c", session_id="o2c_web_test")
    assert r["rows"] > 100
    assert r["dataset_name"] == "o2c_sales"
    assert r["insights"]["total_insights"] >= 1
    assert "Order-to-Cash" in r["report_markdown"]
    assert "%%" not in r["report_markdown"]


def test_run_dota2_example_in_memory():
    r = examples.run_example("dota2", session_id="dota2_web_test")
    assert r.get("focus_games", 0) >= 0
    assert "dataset_name" in r
    assert "report_markdown" in r


def test_examples_rest_list_and_run():
    listed = client.get("/api/v1/examples").json()
    assert "examples" in listed
    run = client.post("/api/v1/examples/o2c/run", json={"session_id": "rest_o2c"}).json()
    assert run.get("dataset_name") == "o2c_sales"
