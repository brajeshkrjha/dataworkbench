"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers.looker import RESULT_HEADERS as LOOKER_RESULT_HEADERS
from app.api.routers.parquet import RESULT_HEADERS
from app.api.v1 import api_v1_router
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
    expose_headers=["Content-Disposition", *RESULT_HEADERS, *LOOKER_RESULT_HEADERS],
)

app.add_exception_handler(DataWorkbenchError, dataworkbench_exception_handler)

app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"], summary="Root")
def read_root() -> dict[str, str]:
    """Basic root endpoint pointing to API docs."""
    return {
        "app": settings.app_name,
        "tagline": settings.app_tagline,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }
