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

# Prevent PyTorch from using 100% of the CPU and lagging local development machines
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

    # Init AI pipeline (loads model if .pth exists, else demo mode)
    from ai.pipeline import init_pipeline
    model_path = os.getenv("MODEL_PATH", "models/best_dr_model.pth")
    if not os.path.exists(model_path):
        alt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "best_dr_model.pth")
        if os.path.exists(alt_path):
            model_path = alt_path

    pipeline   = init_pipeline(model_path=model_path, device="cpu")
    logger.info(
        f"AI Pipeline ready | demo_mode={pipeline.demo_mode}"
    )

    # Pre-load demo patient cases for live demo
    from routes.demo import load_demo_cases
    load_demo_cases()
    logger.info("Demo cases pre-loaded")

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
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins     = CORS_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Routes ───────────────────────────────────────────────────
from routes.analyse   import router as analyse_router
from routes.validate  import router as validate_router
from routes.stats     import router as stats_router
from routes.patients  import router as patients_router
from routes.report    import router as report_router
from routes.demo      import router as demo_router
from routes.followups import router as followups_router
from auth.router      import router as auth_router

app.include_router(auth_router,      prefix="/auth", tags=["Auth"])
app.include_router(analyse_router,   prefix="/api",  tags=["Screening"])
app.include_router(validate_router,  prefix="/api",  tags=["Validation"])
app.include_router(stats_router,     prefix="/api",  tags=["Analytics"])
app.include_router(patients_router,  prefix="/api",  tags=["Patients"])
app.include_router(report_router,    prefix="/api",  tags=["Reports"])
app.include_router(demo_router,      prefix="/api",  tags=["Demo"])
app.include_router(followups_router, prefix="/api",  tags=["Follow-Ups"])


# ── Health Check ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
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


# ── Global error handler ──────────────────────────────────────
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    parts = str(exc).split(":", 1)
    code  = parts[0].strip() if len(parts) > 1 else "BAD_REQUEST"
    msg   = parts[1].strip() if len(parts) > 1 else str(exc)
    return JSONResponse(status_code=400, content={"error": code, "message": msg})


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
