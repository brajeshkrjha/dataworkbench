"""Health check endpoint."""
from fastapi import APIRouter, Depends

from app.api.dependencies.services import settings_dependency
from app.core.config import Settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Health check")
def get_health(settings: Settings = Depends(settings_dependency)) -> HealthResponse:
    """Return application health status."""
    return HealthResponse(app_name=settings.app_name, version=settings.app_version)
