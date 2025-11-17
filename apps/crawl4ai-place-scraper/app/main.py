"""FastAPI entrypoint for the Crawl4AI place scraper."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status

from .config import get_settings
from .models import CrawlRequest, PlaceResponse
from .service import Crawl4AIPlaceScraper

settings = get_settings()
logger = logging.getLogger("crawl4ai.app")
scraper = Crawl4AIPlaceScraper(settings)
app = FastAPI(title="Crawl4AI Place Scraper", version="0.1.0")


async def require_api_key(x_api_key: Annotated[str, Header(alias="x-api-key")]) -> None:
    if x_api_key != settings.app_api_key:
        logger.warning("Unauthorized request rejected")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@app.on_event("startup")
async def startup_event() -> None:
    logger.info("Starting Crawl4AI scraper service")
    await scraper.start()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    logger.info("Stopping Crawl4AI scraper service")
    await scraper.shutdown()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/crawl", response_model=PlaceResponse)
async def crawl_endpoint(
    payload: CrawlRequest,
    _: Annotated[None, Depends(require_api_key)],
) -> PlaceResponse:
    logger.debug("Received crawl request", extra={"url": payload.url})
    try:
        result = await scraper.crawl(payload.url)
        # Avoid using reserved LogRecord attribute names like "name" in `extra`
        logger.debug(
            "Returning crawl result",
            extra={"url": payload.url, "place_name": result.name},
        )
        return result
    except ValueError as exc:
        logger.warning("Rejecting crawl request", extra={"url": payload.url, "error": str(exc)})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Crawl failed", extra={"url": payload.url})
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Crawl failed") from exc
