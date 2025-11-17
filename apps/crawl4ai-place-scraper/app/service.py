"""Crawl4AI orchestration and business logic."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
    LLMConfig,
    LLMExtractionStrategy,
)

from .config import Settings
from .models import PlaceExtractionSchema, PlaceResponse

logger = logging.getLogger("crawl4ai.place_scraper")

PLACE_SCHEMA = PlaceExtractionSchema.model_json_schema()
CATEGORY_KEYWORDS = {
    "restaurant": {"restaurant", "diner", "bistro", "eatery"},
    "bar": {"bar", "pub", "brewery", "taproom"},
    "cafe": {"cafe", "coffee", "tea", "espresso"},
    "hotel": {"hotel", "lodging", "resort", "inn"},
    "landmark": {"landmark", "monument", "museum"},
    "attraction": {"attraction", "theme park", "zoo", "gallery", "aquarium"},
    "other": set(),
}


def normalize_url(raw_url: str) -> str:
    """Normalize user-provided URL strings."""

    candidate = (raw_url or "").strip()
    if not candidate:
        raise ValueError("URL cannot be empty")

    if candidate.startswith("http://") or candidate.startswith("https://"):
        parsed = urlparse(candidate)
    elif candidate.startswith("www."):
        parsed = urlparse(f"https://{candidate}")
    else:
        parsed = urlparse(f"https://{candidate}")

    if not parsed.netloc:
        raise ValueError(f"Invalid URL provided: {raw_url}")

    normalized = parsed.geturl()
    return normalized


def _safe_json_loads(payload: Optional[str]) -> Dict[str, Any]:
    if not payload:
        return {}
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        logger.debug("Failed to parse extracted JSON", extra={"payload": payload[:500]})
        return {}

    if isinstance(data, list):
        return data[0] if data else {}
    if isinstance(data, dict):
        return data
    return {}


def _normalize_category(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    lowered = value.strip().lower()
    if not lowered:
        return None

    for canonical, keywords in CATEGORY_KEYWORDS.items():
        if lowered == canonical:
            return canonical
        if any(keyword in lowered for keyword in keywords):
            return canonical
    return "other"


class Crawl4AIPlaceScraper:
    """High-level wrapper around Crawl4AI for place extraction."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._crawler: Optional[AsyncWebCrawler] = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        if self._crawler:
            return
        logger.debug("Initializing AsyncWebCrawler", extra={"headless": self.settings.browser_headless})
        browser_config = BrowserConfig(
            headless=self.settings.browser_headless,
            verbose=self.settings.log_level.upper() == "DEBUG",
        )
        self._crawler = AsyncWebCrawler(config=browser_config)
        await self._crawler.start()
        logger.info("AsyncWebCrawler ready")

    async def shutdown(self) -> None:
        if not self._crawler:
            return
        logger.debug("Shutting down AsyncWebCrawler")
        await self._crawler.close()
        self._crawler = None

    async def crawl(self, url: str) -> PlaceResponse:
        if not self._crawler:
            await self.start()

        normalized_url = normalize_url(url)
        logger.debug("Normalized URL", extra={"url": url, "normalized": normalized_url})

        run_config = self._build_run_config()

        attempt = 0
        last_error: Optional[Exception] = None
        while attempt <= self.settings.max_retries:
            attempt += 1
            try:
                async with self._lock:
                    logger.debug("Starting Crawl4AI run", extra={"url": normalized_url, "attempt": attempt})
                    result = await self._crawler.arun(url=normalized_url, config=run_config)
                logger.debug(
                    "Crawl4AI run completed",
                    extra={
                        "url": normalized_url,
                        "status": getattr(result, "status_code", None),
                        "bytes": len(getattr(result, "html", "") or ""),
                    },
                )
                extracted = _safe_json_loads(getattr(result, "extracted_content", None))
                logger.debug("Raw extracted payload", extra={"payload": extracted})
                if not extracted or not extracted.get("name"):
                    raise ValueError("Crawl4AI did not return a place name")
                return self._to_response(extracted)
            except Exception as exc:  # pragma: no cover - best effort logging
                last_error = exc
                logger.exception(
                    "Crawl attempt failed",
                    extra={"url": normalized_url, "attempt": attempt, "error": str(exc)},
                )
                if attempt > self.settings.max_retries:
                    break
        assert last_error is not None
        raise last_error

    def _build_run_config(self) -> CrawlerRunConfig:
        instruction = (
            "Extract a single physical place or business described on the page. "
            "Fill every field if present. The category must be exactly one of "
            "restaurant, bar, cafe, hotel, landmark, attraction, other."
        )
        extraction_strategy = LLMExtractionStrategy(
            llm_config=LLMConfig(
                provider=self.settings.llm_provider,
                api_token=self.settings.llm_api_key,
            ),
            schema=PLACE_SCHEMA,
            extraction_type="schema",
            instruction=instruction,
        )

        run_config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            extraction_strategy=extraction_strategy,
            word_count_threshold=1,
            page_timeout=self.settings.request_timeout_seconds * 1000,
            verbose=self.settings.log_level.upper() == "DEBUG",
        )
        return run_config

    def _to_response(self, payload: Dict[str, Any]) -> PlaceResponse:
        address = payload.get("address") or payload.get("formatted_address")
        response = PlaceResponse(
            name=payload.get("name", ""),
            address=address,
            formatted_address=payload.get("formatted_address") or address,
            phone=payload.get("phone"),
            website=payload.get("website"),
            category=_normalize_category(payload.get("category")),
        )
        logger.debug("Returning normalized payload", extra={"payload": response.model_dump()})
        return response
