# dr-screening/Dockerfile
# Full-stack multi-stage build: Builds React frontend and FastAPI backend into a single image.
# Suitable for Cloud Run, Render, and other serverless container platforms.

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend/dr-dashboard

# Copy package manifests first to leverage Docker cache
COPY frontend/dr-dashboard/package*.json ./
RUN npm ci

# Copy the rest of the frontend source
COPY frontend/dr-dashboard/ ./
RUN npm run build

# ── Stage 2: Build Backend Dependencies ──────────────────────
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend

# System dependencies for opencv-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# ── Stage 3: Runtime Environment ─────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install system dependencies required at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies from stage 2
COPY --from=backend-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy backend source
COPY backend/ /app/backend/

# Copy built frontend dist from stage 1
COPY --from=frontend-builder /app/frontend/dr-dashboard/dist /app/frontend/dr-dashboard/dist

# Ensure storage directories exist
RUN mkdir -p /app/backend/models /app/backend/media/screenings /app/backend/reports

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV HF_HUB_OFFLINE=1
# Prevent glibc memory fragmentation (crucial for restricted RAM limits)
ENV MALLOC_ARENA_MAX=2
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV MODEL_DOWNLOAD_URL=https://huggingface.co/omii5/retinai-dr-model/resolve/main/best_dr_model.pth?download=true

EXPOSE 8000 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
