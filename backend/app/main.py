"""FastAPI application entrypoint."""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.result_headers import LOOKER_RESULT_HEADERS, PARQUET_RESULT_HEADERS
from app.api.v1 import LazyHeavyRouters, build_api_v1_router, build_light_router
from app.core.config import get_settings
from app.core.exceptions import DataWorkbenchError, dataworkbench_exception_handler
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(debug=settings.debug)

app = FastAPI(
    title=settings.app_name,
    description=settings.app_tagline,
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", *PARQUET_RESULT_HEADERS, *LOOKER_RESULT_HEADERS],
)

app.add_exception_handler(DataWorkbenchError, dataworkbench_exception_handler)

# On serverless (Vercel) every cold start re-imports the app, so keep pandas/pyarrow
# out of the startup path and mount the heavy routers on first use instead.
if settings.lazy_heavy_routers or os.getenv("VERCEL"):
    app.include_router(build_light_router(), prefix=settings.api_v1_prefix)
    app.add_middleware(LazyHeavyRouters, fastapi_app=app, api_prefix=settings.api_v1_prefix)
else:
    app.include_router(build_api_v1_router(), prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"], summary="Root")
def read_root() -> dict[str, str]:
    """Basic root endpoint pointing to API docs."""
    return {
        "app": settings.app_name,
        "tagline": settings.app_tagline,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }
