"""Version information endpoint."""
from fastapi import APIRouter, Depends

from app.api.dependencies.services import settings_dependency
from app.core.config import Settings
from app.schemas.common import VersionResponse

router = APIRouter(tags=["version"])


@router.get("/version", response_model=VersionResponse, summary="Application version")
def get_version(settings: Settings = Depends(settings_dependency)) -> VersionResponse:
    """Return application name, tagline, and version."""
    return VersionResponse(
        app_name=settings.app_name,
        tagline=settings.app_tagline,
        version=settings.app_version,
    )
