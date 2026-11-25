"""API key authentication for all /api/v1/** endpoints.

Policy when no keys are configured:
  REQUIRE_AUTH=True (default) + empty API_KEYS -> the app refuses to start.
  REQUIRE_AUTH=False           + empty API_KEYS -> auth disabled, loud warning at startup.
Never silently open, never crash without an explanation.
"""

import logging
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader

from data_analysis.config import settings

logger = logging.getLogger(__name__)

API_KEY_HEADER_NAME = "X-API-Key"

# Everything under this prefix requires a key. Registered once as an app-level
# dependency so a new endpoint is protected the moment it is added, rather than
# relying on 40+ hand-written Depends() that one PR can forget.
PROTECTED_PATH_PREFIX = "/api/v1"

# auto_error=False so we control the 401 vs 403 distinction ourselves.
_api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


class AuthConfigError(RuntimeError):
    """Raised at import/startup when auth is required but unconfigured."""


def validate_auth_config(keys: list[str] | None = None) -> None:
    """Fail fast at startup rather than serving an unprotected port."""
    keys = settings.api_key_list if keys is None else keys
    if keys:
        return
    if settings.REQUIRE_AUTH:
        raise AuthConfigError(
            "No API keys configured but REQUIRE_AUTH is True. Set "
            "DATA_ANALYSIS_API_KEYS to a comma-separated list of secrets, or set "
            "DATA_ANALYSIS_REQUIRE_AUTH=false for trusted local development only. "
            "Refusing to start: every /api/v1 endpoint would otherwise be open, "
            "including SQL execution and outbound webhook delivery."
        )
    logger.warning(
        "AUTH DISABLED: REQUIRE_AUTH=false and no API keys configured. Every "
        "/api/v1 endpoint is unauthenticated. Never use this configuration on a "
        "network-reachable port."
    )


def _matches_any(submitted: str, keys: list[str]) -> bool:
    # compare_digest against every key so timing does not reveal which key
    # matched or how many are configured. No short-circuit on first match.
    matched = False
    for key in keys:
        if secrets.compare_digest(submitted, key):
            matched = True
    return matched


def require_api_key(request: Request, api_key: str | None = Depends(_api_key_header)) -> None:
    """Dependency guarding every /api/v1 route.

    Registered app-level, so it also sees the public routes (/health, /dashboard)
    and lets those through by path. Raises 401 when the header is absent, 403
    when it is present but wrong. The submitted value is never included in the
    detail or in any log record.
    """
    if not request.url.path.startswith(PROTECTED_PATH_PREFIX):
        return

    keys = settings.api_key_list
    if not keys:
        # validate_auth_config() already refused to start if REQUIRE_AUTH.
        return

    if api_key is None or api_key == "":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing {API_KEY_HEADER_NAME} header",
            headers={"WWW-Authenticate": API_KEY_HEADER_NAME},
        )

    if not _matches_any(api_key, keys):
        # Log the rejection but never the value that was submitted.
        logger.warning("Rejected request with invalid %s header", API_KEY_HEADER_NAME)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )
