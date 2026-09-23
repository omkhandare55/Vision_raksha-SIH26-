# backend/main.py
# FastAPI application entry point
# Spec: TRD Section 3, 5

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import torch

# Do NOT use torch.set_num_threads(1) on Render as it triggers a known OpenMP deadlock during model loading.
# Default PyTorch thread pool is fine.
if not os.getenv("RENDER"):
    torch.set_num_threads(2)

load_dotenv()

# ── Logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("retinai")

# ── Rate Limiter ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


# ── Lifespan (startup / shutdown) ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ─────────────────────────────────────────────
    logger.info("RetinAI starting up...")

    # Init DB tables
    from db.database import init_db
    init_db()
    logger.info("Database tables ready")

    # Init AI pipeline (loads model if .pth exists, or downloads if MODEL_DOWNLOAD_URL provided)
    from ai.pipeline import init_pipeline
    model_path = os.getenv("MODEL_PATH", "models/best_dr_model.pth")
    if not os.path.exists(model_path):
        alt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "best_dr_model.pth")
        if os.path.exists(alt_path):
            model_path = alt_path

    # Fix Git LFS pointer issue in cloud builds:
    # If the file exists but is very small (< 1MB), it's likely a Git LFS pointer, not the actual weights.
    # Delete it so the auto-downloader can fetch the real model.
    if os.path.exists(model_path) and os.path.getsize(model_path) < 1024 * 1024:
        logger.warning(f"Model file {model_path} is suspiciously small ({os.path.getsize(model_path)} bytes). It might be a Git LFS pointer. Removing it to trigger download.")
        os.remove(model_path)

    # Optional cloud auto-download (e.g. Render / Cloud Run)
    download_url = os.getenv("MODEL_DOWNLOAD_URL") or os.getenv("MODEL_URL")
    if not os.path.exists(model_path) and download_url:
        try:
            logger.info(f"Downloading model weights from: {download_url} ...")
            os.makedirs(os.path.dirname(model_path) or "models", exist_ok=True)
            import urllib.request
            import shutil
            with urllib.request.urlopen(download_url, timeout=60) as response, open(model_path, 'wb') as out_file:
                shutil.copyfileobj(response, out_file)
            logger.info(f"Model weights downloaded successfully to {model_path}")
        except Exception as e:
            logger.warning(f"Failed to download model weights from {download_url}: {e}")

    pipeline   = init_pipeline(model_path=model_path, device="cpu")
    logger.info(
        f"AI Pipeline ready | model_active={not pipeline.demo_mode}"
    )

    yield

    # ── SHUTDOWN ────────────────────────────────────────────
    logger.info("RetinAI shutting down...")


# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title       = "RetinAI — DR Screening API",
    description = "Explainable AI for Diabetic Retinopathy Screening | SIH26038",
    version     = "1.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
    lifespan    = lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8000").strip()
if cors_origins_str == "*" or os.getenv("ENVIRONMENT", "development") != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex = r".*",
        allow_credentials  = True,
        allow_methods      = ["*"],
        allow_headers      = ["*"],
    )
else:
    CORS_ORIGINS = [orig.strip() for orig in cors_origins_str.split(",") if orig.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins      = CORS_ORIGINS,
        allow_origin_regex = r"https://.*\.vercel\.app|https://.*\.onrender\.com",
        allow_credentials  = True,
        allow_methods      = ["*"],
        allow_headers      = ["*"],
    )


# ── Routes ───────────────────────────────────────────────────
from routes.analyse       import router as analyse_router
from routes.validate      import router as validate_router
from routes.stats         import router as stats_router
from routes.patients      import router as patients_router
from routes.report        import router as report_router
from routes.demo          import router as demo_router
from routes.followups     import router as followups_router
from routes.admin         import router as admin_router
from routes.doctor_reviews import router as reviews_router
from auth.router          import router as auth_router

app.include_router(auth_router,      prefix="/auth",        tags=["Auth"])
app.include_router(analyse_router,   prefix="/api",         tags=["Screening"])
app.include_router(validate_router,  prefix="/api",         tags=["Validation"])
app.include_router(stats_router,     prefix="/api",         tags=["Analytics"])
app.include_router(patients_router,  prefix="/api",         tags=["Patients"])
app.include_router(report_router,    prefix="/api",         tags=["Reports"])
app.include_router(demo_router,      prefix="/api",         tags=["Demo"])
app.include_router(followups_router, prefix="/api",         tags=["Follow-Ups"])
app.include_router(admin_router,     prefix="/api/admin",   tags=["Admin"])
app.include_router(reviews_router,   prefix="/api/reviews", tags=["Doctor Reviews"])


# ── Static Files & SPA Fallback (Frontend Integration) ────────
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Serve uploaded screening images (fundus + heatmap)
media_dir = os.path.join(os.path.dirname(__file__), "media")
if os.path.exists(media_dir):
    app.mount("/media", StaticFiles(directory=media_dir), name="media")

dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dr-dashboard", "dist")
if os.path.exists(dist_dir):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# ── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    from ai.pipeline import _pipeline
    return {
        "status"      : "ok",
        "service"     : "RetinAI DR Screening API",
        "version"     : "1.0.0",
        "model_loaded": _pipeline is not None and not _pipeline.demo_mode,
        "demo_mode"   : _pipeline.demo_mode if _pipeline else True,
    }


# ── SPA Fallback Handler ──────────────────────────────────────
@app.get("/{full_path:path}", tags=["Frontend"])
async def serve_spa(full_path: str):
    if os.path.exists(dist_dir):
        target_file = os.path.join(dist_dir, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        
        # If it's explicitly requesting an asset that's missing, don't return index.html
        if full_path.endswith((".ico", ".png", ".jpg", ".svg", ".js", ".css", ".json")):
            return JSONResponse(status_code=404, content={"error": "NOT_FOUND", "message": "Asset not found"})
            
        index_file = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
            
    if not full_path or full_path == "/":
        return {"status": "ok", "message": "RetinAI API running. Frontend not built."}
    return JSONResponse(status_code=404, content={"error": "NOT_FOUND", "message": "Resource not found"})


# ── Global error handler ──────────────────────────────────────
# Note: bcrypt 72-byte limit is handled by SHA-256 pre-hashing in auth/jwt.py
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    msg = str(exc)
    return JSONResponse(status_code=400, content={"error": "BAD_REQUEST", "message": msg})


@app.exception_handler(Exception)
async def generic_error_handler(request, exc):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred"}
    )


# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
