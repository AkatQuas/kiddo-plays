"""
Generic session broker.

Illustrates a management architecture where:
  - accounts hold opaque credential blobs (never logged in full)
  - callers address accounts by id, not by raw secrets
  - upstream failures can mark a session expired for ops dashboards

This is intentionally protocol-agnostic. Wire your own official APIs
behind `UpstreamCall`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class AccountSession:
    account_id: str
    label: str = ""
    credential: str = ""
    region: str = "default"
    login_ok: bool = True
    meta: dict[str, Any] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=utcnow)

    def public_view(self) -> dict:
        return {
            "account_id": self.account_id,
            "label": self.label,
            "region": self.region,
            "login_ok": self.login_ok,
            "credential_suffix": self.credential[-4:] if self.credential else "",
            "updated_at": self.updated_at.isoformat(),
        }


UpstreamCall = Callable[[AccountSession, dict[str, Any]], Awaitable[Any]]


class SessionBroker:
    def __init__(self) -> None:
        self._accounts: dict[str, AccountSession] = {}

    def upsert(self, session: AccountSession) -> AccountSession:
        session.updated_at = utcnow()
        self._accounts[session.account_id] = session
        return session

    def get(self, account_id: str) -> Optional[AccountSession]:
        return self._accounts.get(account_id)

    def list_public(self) -> list[dict]:
        return [a.public_view() for a in self._accounts.values()]

    def mark_expired(self, account_id: str) -> None:
        acc = self._accounts.get(account_id)
        if acc:
            acc.login_ok = False
            acc.updated_at = utcnow()

    async def call(
        self,
        account_id: str,
        payload: dict[str, Any],
        upstream: UpstreamCall,
        *,
        is_auth_error: Callable[[BaseException], bool] | None = None,
    ) -> Any:
        acc = self._accounts.get(account_id)
        if not acc:
            raise KeyError(f"unknown account_id: {account_id}")
        if not acc.login_ok:
            raise PermissionError(f"account session expired: {account_id}")
        try:
            return await upstream(acc, payload)
        except Exception as exc:
            if is_auth_error and is_auth_error(exc):
                self.mark_expired(account_id)
            raise
