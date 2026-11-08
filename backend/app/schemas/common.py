"""Common/shared response schemas used across the API."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class HealthResponse(BaseModel):
    """Response payload for the health check endpoint."""

    status: str = "ok"
    app_name: str
    version: str


class VersionResponse(BaseModel):
    """Response payload for the version endpoint."""

    app_name: str
    tagline: str
    version: str
    api_version: str = "v1"


class ErrorResponse(BaseModel):
    """Standard error response shape."""

    error: str
    message: str


class DataResponse(BaseModel, Generic[T]):
    """Generic envelope for successful data responses."""

    data: T
