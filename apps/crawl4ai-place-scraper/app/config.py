"""Application configuration helpers."""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Runtime configuration for the Crawl4AI app."""

    app_api_key: str = Field(..., description="API key required via request header")
    llm_api_key: str = Field(..., description="Token passed to Crawl4AI's LLM extraction strategy")
    llm_provider: str = Field(
        default="openai/gpt-4o-mini",
        description="Provider+model identifier understood by Crawl4AI / LiteLLM",
    )
    log_level: str = Field(default="INFO", description="Python logging level")
    browser_headless: bool = Field(default=True, description="Run Playwright browser headless")
    request_timeout_seconds: int = Field(default=180, description="Overall Crawl4AI timeout")
    max_retries: int = Field(default=2, description="Number of Crawl4AI retries before failing")

    @property
    def log_level_int(self) -> int:
        return getattr(logging, self.log_level.upper(), logging.INFO)


def _get_env(name: str, fallback: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is not None:
        return value
    if fallback:
        return os.getenv(fallback)
    return None


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@lru_cache
def get_settings() -> Settings:
    """Load settings once per process."""

    app_api_key = _get_env("CRAWL4AI_APP_API_KEY", fallback="APP_API_KEY")
    llm_key = _get_env("CRAWL4AI_LLM_API_KEY", fallback="OPENAI_API_KEY")

    if not app_api_key:
        raise RuntimeError("Missing required CRAWL4AI_APP_API_KEY or APP_API_KEY env var")
    if not llm_key:
        raise RuntimeError("Missing required CRAWL4AI_LLM_API_KEY or OPENAI_API_KEY env var")

    settings = Settings(
        app_api_key=app_api_key,
        llm_api_key=llm_key,
        llm_provider=_get_env("CRAWL4AI_LLM_PROVIDER") or "openai/gpt-4o-mini",
        log_level=_get_env("CRAWL4AI_LOG_LEVEL", fallback="LOG_LEVEL") or "INFO",
        browser_headless=_get_bool("CRAWL4AI_BROWSER_HEADLESS", True),
        request_timeout_seconds=_get_int("CRAWL4AI_TIMEOUT_SECONDS", 180),
        max_retries=_get_int("CRAWL4AI_MAX_RETRIES", 2),
    )

    logging.basicConfig(
        level=settings.log_level_int,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    return settings
