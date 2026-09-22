"""Demo / playground endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/demo/health")
async def demo_health():
    return {"status": "ok", "module": "demo"}
