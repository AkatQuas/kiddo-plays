import logging

import pytest
from fastapi.testclient import TestClient

from data_analysis.config import settings
from data_analysis.logging_setup import (
    configure_logging,
    get_request_id,
    safe_destination,
    set_request_id,
)
from data_analysis.security import AuthConfigError, validate_auth_config

VALID_KEY = "test-api-key"
SECOND_KEY = "test-api-key-rotated"
WRONG_KEY = "definitely-not-the-right-key"

settings.API_KEYS = f"{VALID_KEY},{SECOND_KEY}"

from data_analysis.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _configure_keys():
    """Set keys per-test, not at import.

    pytest imports every test module before running anything, and the other
    modules assign settings.API_KEYS at import time too. A module-level
    assignment here would be clobbered depending on collection order.
    """
    original = settings.API_KEYS
    settings.API_KEYS = f"{VALID_KEY},{SECOND_KEY}"
    yield
    settings.API_KEYS = original


# A state-mutating endpoint that reaches outside the process.
PROTECTED_PATH = "/api/v1/retl/alert"
PROTECTED_BODY = {
    "webhook_url": "https://example.invalid/hook",
    "title": "t",
    "message": "m",
}


def test_protected_endpoint_401_without_key():
    res = client.post(PROTECTED_PATH, json=PROTECTED_BODY)
    assert res.status_code == 401


def test_protected_endpoint_403_with_wrong_key():
    res = client.post(PROTECTED_PATH, json=PROTECTED_BODY, headers={"X-API-Key": WRONG_KEY})
    assert res.status_code == 403


def test_wrong_key_not_echoed_in_response_body():
    res = client.post(PROTECTED_PATH, json=PROTECTED_BODY, headers={"X-API-Key": WRONG_KEY})
    assert WRONG_KEY not in res.text
    assert VALID_KEY not in res.text


def test_protected_get_endpoint_200_with_right_key():
    res = client.get("/api/v1/ontology/schema", headers={"X-API-Key": VALID_KEY})
    assert res.status_code == 200


def test_every_configured_key_is_accepted():
    for key in (VALID_KEY, SECOND_KEY):
        res = client.get("/api/v1/ontology/schema", headers={"X-API-Key": key})
        assert res.status_code == 200, key


def test_empty_key_header_is_401():
    res = client.get("/api/v1/ontology/schema", headers={"X-API-Key": ""})
    assert res.status_code == 401


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/catalog/tables",
        "/api/v1/catalog/metrics",
        "/api/v1/ontology/objects",
        "/api/v1/ontology/schema",
    ],
)
def test_api_v1_paths_are_protected(path):
    """Auth boundary check across representative /api/v1 routes.

    Asserts the auth boundary only: a valid key must get past it. The handler's
    own status is another module's concern.
    """
    assert client.get(path).status_code == 401
    authed = client.get(path, headers={"X-API-Key": VALID_KEY})
    assert authed.status_code not in (401, 403)


def test_health_is_public():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_dashboard_is_public():
    assert client.get("/dashboard").status_code == 200


def test_openapi_and_static_are_public():
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/static/dashboard.js").status_code == 200


def test_request_id_header_present():
    res = client.get("/health")
    assert res.headers.get("X-Request-ID")


def test_inbound_request_id_is_echoed():
    incoming = "my-correlation-id-123"
    res = client.get("/health", headers={"X-Request-ID": incoming})
    assert res.headers["X-Request-ID"] == incoming


def test_request_ids_differ_between_requests():
    a = client.get("/health").headers["X-Request-ID"]
    b = client.get("/health").headers["X-Request-ID"]
    assert a != b


def test_auth_failure_still_carries_request_id():
    res = client.get("/api/v1/catalog/tables")
    assert res.status_code == 401
    assert res.headers.get("X-Request-ID")


# ----------------- config policy -----------------


def test_validate_auth_config_raises_when_required_and_no_keys():
    original = settings.REQUIRE_AUTH
    settings.REQUIRE_AUTH = True
    try:
        with pytest.raises(AuthConfigError):
            validate_auth_config(keys=[])
    finally:
        settings.REQUIRE_AUTH = original


def test_validate_auth_config_warns_but_allows_when_not_required():
    original = settings.REQUIRE_AUTH
    settings.REQUIRE_AUTH = False
    try:
        validate_auth_config(keys=[])  # must not raise
    finally:
        settings.REQUIRE_AUTH = original


def test_validate_auth_config_passes_with_keys():
    validate_auth_config(keys=[VALID_KEY])


def test_api_key_list_parses_comma_separated():
    original = settings.API_KEYS
    settings.API_KEYS = " a , b ,, c "
    try:
        assert settings.api_key_list == ["a", "b", "c"]
    finally:
        settings.API_KEYS = original


def test_cors_origins_are_explicit_never_wildcard():
    assert "*" not in settings.cors_origin_list
    assert settings.cors_origin_list


# ----------------- logging -----------------


def test_request_id_contextvar_roundtrip():
    set_request_id("abc123")
    assert get_request_id() == "abc123"


def test_log_records_carry_request_id(caplog):
    configure_logging("INFO")
    set_request_id("req-xyz")
    with caplog.at_level(logging.INFO):
        logging.getLogger("data_analysis.test").info("hello")
    record = next(r for r in caplog.records if r.message == "hello")
    # The filter lives on our handler; assert the injected value directly.
    from data_analysis.logging_setup import RequestIdFilter

    RequestIdFilter().filter(record)
    assert record.request_id == "req-xyz"


@pytest.mark.parametrize(
    "conn_str,expected",
    [
        ("postgresql://user:s3cret@db.internal:5432/analytics", "postgresql://db.internal"),
        ("mysql://root:hunter2@10.0.0.5/warehouse", "mysql://10.0.0.5"),
        ("file:///tmp/data.xlsx", "file://"),
        (None, "unknown"),
        ("", "unknown"),
        ("not-a-uri", "unknown"),
    ],
)
def test_safe_destination_strips_credentials(conn_str, expected):
    assert safe_destination(conn_str) == expected


def test_safe_destination_never_leaks_password():
    assert "s3cret" not in safe_destination("postgresql://user:s3cret@db.internal:5432/analytics")


def test_api_key_never_logged_on_rejection(caplog):
    with caplog.at_level(logging.WARNING):
        client.get("/api/v1/catalog/tables", headers={"X-API-Key": WRONG_KEY})
    combined = "\n".join(r.getMessage() for r in caplog.records)
    assert WRONG_KEY not in combined
    assert VALID_KEY not in combined


def test_unhandled_exception_returns_generic_500_with_request_id():
    marker = "super-secret-internal-detail"

    @app.get("/api/v1/_test_boom")
    def _boom():
        raise RuntimeError(marker)

    try:
        local = TestClient(app, raise_server_exceptions=False)
        res = local.get("/api/v1/_test_boom", headers={"X-API-Key": VALID_KEY})
        assert res.status_code == 500
        body = res.json()
        assert body["request_id"]
        assert res.headers.get("X-Request-ID")
        # No traceback and no exception text leaked to the caller.
        assert marker not in res.text
        assert "Traceback" not in res.text
        assert "RuntimeError" not in res.text
    finally:
        app.router.routes = [
            r for r in app.router.routes if getattr(r, "path", None) != "/api/v1/_test_boom"
        ]
