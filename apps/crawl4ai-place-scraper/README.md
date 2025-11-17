# Crawl4AI Place Scraper

A lightweight FastAPI service that mirrors the interface of the existing Firecrawl-based Convex action. It accepts a URL and synchronously returns place metadata (name, address, phone, website, category) extracted with Crawl4AI's LLM-powered schema extraction.

## Features
- Async Crawl4AI pipeline with schema-based extraction
- Enforces the `restaurant | bar | cafe | hotel | landmark | attraction | other` category taxonomy
- Response mirrors the Firecrawl contract (`name`, `formatted_address`, `phone`, `website`) while adding `category`
- API-key protected `/crawl` endpoint + `/health` probe
- Extensive debug logging to trace the crawl lifecycle

## Requirements
- Python 3.12+
- Playwright browsers (install via `playwright install`)
- Access to an LLM provider supported by [LiteLLM](https://docs.litellm.ai/docs/providers) (default: `openai/gpt-4o-mini`)

## Configuration
| Variable | Description |
| --- | --- |
| `CRAWL4AI_APP_API_KEY` (or `APP_API_KEY`) | Shared secret required in the `x-api-key` header |
| `CRAWL4AI_LLM_API_KEY` (or `OPENAI_API_KEY`) | Token passed to the LLM extraction strategy |
| `CRAWL4AI_LLM_PROVIDER` | LiteLLM provider/model string, default `openai/gpt-4o-mini` |
| `CRAWL4AI_BROWSER_HEADLESS` | `true/false`, controls Playwright headless mode (default `true`) |
| `CRAWL4AI_TIMEOUT_SECONDS` | Crawl timeout in seconds (default `180`) |
| `CRAWL4AI_MAX_RETRIES` | Number of retries before surfacing an error (default `2`) |
| `CRAWL4AI_LOG_LEVEL` | Python log level, e.g. `DEBUG` for verbose tracing |

## Installation
```bash
cd apps/crawl4ai-place-scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install  # required for Crawl4AI's Playwright integration
```

## Running Locally
```bash
export CRAWL4AI_APP_API_KEY="local-dev-key"
export CRAWL4AI_LLM_API_KEY="sk-your-provider-token"
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Usage
```bash
curl -X POST http://localhost:8080/crawl \
  -H "Content-Type: application/json" \
  -H "x-api-key: local-dev-key" \
  -d '{"url": "https://www.examplecafe.com"}'
```
Response:
```json
{
  "name": "Example Cafe",
  "address": "123 Main St, Springfield, USA",
  "formatted_address": "123 Main St, Springfield, USA",
  "phone": "+1 555-0100",
  "website": "https://www.examplecafe.com",
  "category": "cafe"
}
```

## Deployment Notes
- Containerize with any ASGI base image; run under `uvicorn` or `gunicorn -k uvicorn.workers.UvicornWorker`.
- Ensure the service has outbound internet to fetch target pages and reach your LLM provider.
- Mount a writable home directory (`$HOME/.crawl4ai`) so Crawl4AI can cache browser assets.
- Monitor logs (`DEBUG` level recommended in staging) to inspect extraction payloads and crawler performance.
