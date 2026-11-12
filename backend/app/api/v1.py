"""Aggregates all v1 API routers under a single router.

Light routers (health, version, tools) are always mounted. Heavy routers pull in
pandas/pyarrow (slow to import, much slower on a serverless cold start), so they can
be mounted lazily on the first request that needs them via `LazyHeavyRouters`.
"""
import threading

from fastapi import APIRouter, FastAPI
from starlette.types import ASGIApp, Receive, Scope, Send

from app.api.routers import health, tools, version

# Path prefixes (relative to the API prefix) served by heavy routers.
HEAVY_PREFIXES = (
    "/tools/parquet-utility",
    "/tools/gcp-looker-utility",
    "/tools/text-compare-utility",
)
# Schema/doc routes must see every router.
SCHEMA_PATHS = ("/openapi.json", "/docs", "/redoc")


def build_light_router() -> APIRouter:
    router = APIRouter()
    router.include_router(health.router)
    router.include_router(version.router)
    router.include_router(tools.router)
    return router


def build_heavy_router() -> APIRouter:
    from app.api.routers import looker, parquet, text_compare

    router = APIRouter()
    router.include_router(parquet.router)
    router.include_router(looker.router)
    router.include_router(text_compare.router)
    return router


def build_api_v1_router() -> APIRouter:
    router = build_light_router()
    router.include_router(build_heavy_router())
    return router


class LazyHeavyRouters:
    """ASGI middleware mounting heavy routers on the first request that needs them."""

    def __init__(self, app: ASGIApp, fastapi_app: FastAPI, api_prefix: str) -> None:
        self.app = app
        self.fastapi_app = fastapi_app
        self.api_prefix = api_prefix
        self.loaded = False
        self._lock = threading.Lock()

    def _needs_heavy(self, path: str) -> bool:
        if path in SCHEMA_PATHS:
            return True
        if not path.startswith(self.api_prefix):
            return False
        return path[len(self.api_prefix):].startswith(HEAVY_PREFIXES)

    def _load(self) -> None:
        with self._lock:
            if self.loaded:
                return
            self.fastapi_app.include_router(build_heavy_router(), prefix=self.api_prefix)
            # Drop the cached schema so /openapi.json includes the new routes.
            self.fastapi_app.openapi_schema = None
            self.loaded = True

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self.loaded and scope["type"] == "http" and self._needs_heavy(scope["path"]):
            self._load()
        await self.app(scope, receive, send)
