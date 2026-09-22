# backend/Dockerfile
# Multi-stage build — keeps image lean for Render.com (512MB RAM limit)

# ── Stage 1: Build ───────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System deps for opencv-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM base AS runtime

WORKDIR /app
COPY . .

# Create storage and models dirs
RUN mkdir -p models media/screenings reports


ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV HF_HUB_OFFLINE=1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1"]
