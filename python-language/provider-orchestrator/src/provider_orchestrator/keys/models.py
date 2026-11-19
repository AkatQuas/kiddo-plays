"""Provider credential + quota model."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def make_key_id(access_key: str) -> str:
    return hashlib.sha256(access_key.encode("utf-8")).hexdigest()[:16]


class ProviderKey(BaseModel):
    key_id: str
    platform: str
    name: str = ""
    access_key: str
    hour_limit: Optional[int] = 100
    month_limit: Optional[int] = 5000
    hour_used: int = 0
    month_used: int = 0
    hour_window_start: datetime = Field(default_factory=utcnow)
    month_window_start: datetime = Field(default_factory=utcnow)
    active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    @classmethod
    def create(
        cls,
        *,
        platform: str,
        access_key: str,
        name: str = "",
        hour_limit: int | None = 100,
        month_limit: int | None = 5000,
    ) -> "ProviderKey":
        return cls(
            key_id=make_key_id(access_key),
            platform=platform,
            name=name or platform,
            access_key=access_key,
            hour_limit=hour_limit,
            month_limit=month_limit,
        )

    def reset_windows_if_needed(self, now: datetime | None = None) -> None:
        now = now or utcnow()
        if (now - self.hour_window_start).total_seconds() >= 3600:
            self.hour_used = 0
            self.hour_window_start = now
        # calendar-month style reset (UTC)
        if (
            now.year != self.month_window_start.year
            or now.month != self.month_window_start.month
        ):
            self.month_used = 0
            self.month_window_start = now.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )

    def is_available(self, now: datetime | None = None) -> bool:
        if not self.active:
            return False
        self.reset_windows_if_needed(now)
        if self.hour_limit is not None and self.hour_used >= self.hour_limit:
            return False
        if self.month_limit is not None and self.month_used >= self.month_limit:
            return False
        return True

    def public_view(self) -> dict:
        """Safe projection for management UIs (hides raw secret)."""
        return {
            "key_id": self.key_id,
            "platform": self.platform,
            "name": self.name,
            "hour_limit": self.hour_limit,
            "month_limit": self.month_limit,
            "hour_used": self.hour_used,
            "month_used": self.month_used,
            "active": self.active,
            "access_key_suffix": self.access_key[-4:] if self.access_key else "",
        }
