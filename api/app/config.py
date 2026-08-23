from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("SIGNAL_GARDEN_DATABASE_URL", "sqlite:///./signal_garden.db")
    cors_origins: tuple[str, ...] = tuple(
        value.strip()
        for value in os.getenv("SIGNAL_GARDEN_CORS_ORIGINS", "http://localhost:3101").split(",")
        if value.strip()
    )
    retention_days: int = _int("SIGNAL_GARDEN_RETENTION_DAYS", 30)
    ai_provider: str = os.getenv("SIGNAL_GARDEN_AI_PROVIDER", "deterministic")
    ai_model: str = os.getenv("SIGNAL_GARDEN_AI_MODEL", "signal-garden-deterministic-v1")
    ai_api_key: str | None = os.getenv("SIGNAL_GARDEN_AI_API_KEY") or None
    ai_base_url: str | None = os.getenv("SIGNAL_GARDEN_AI_BASE_URL") or None
    ai_timeout_seconds: int = _int("SIGNAL_GARDEN_AI_TIMEOUT_SECONDS", 30)
    ai_max_retries: int = _int("SIGNAL_GARDEN_AI_MAX_RETRIES", 2)
    ai_rate_limit_per_minute: int = _int("SIGNAL_GARDEN_AI_RATE_LIMIT_PER_MINUTE", 30)


settings = Settings()
