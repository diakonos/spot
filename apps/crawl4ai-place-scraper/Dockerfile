FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app
COPY pyproject.toml .

# Install Playwright browsers (and any missing OS deps)
RUN playwright install --with-deps

# Crawl4AI caches browser assets under the home directory; keep it writable
ENV HOME=/home/pwuser

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]


