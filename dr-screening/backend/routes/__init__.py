from routes.analyse  import router as analyse_router
from routes.validate import router as validate_router
from routes.stats    import router as stats_router
from routes.patients import router as patients_router
from routes.report   import router as report_router

__all__ = [
    "analyse_router","validate_router","stats_router",
    "patients_router","report_router",
]
