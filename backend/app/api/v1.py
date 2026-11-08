"""Aggregates all v1 API routers under a single router."""
from fastapi import APIRouter

from app.api.routers import health, looker, parquet, text_compare, tools, version

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(version.router)
api_v1_router.include_router(tools.router)
api_v1_router.include_router(parquet.router)
api_v1_router.include_router(looker.router)
api_v1_router.include_router(text_compare.router)
