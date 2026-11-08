"""Schemas describing tools and tool metadata for the registry API."""
from enum import Enum

from pydantic import BaseModel, Field


class ToolCategory(str, Enum):
    """High-level grouping used to organize tools in the catalog UI."""

    FILE_CONVERSION = "file_conversion"
    FORMATTING = "formatting"
    COMPARISON = "comparison"
    VALIDATION = "validation"
    ETL = "etl"
    DATA_QUALITY = "data_quality"
    METADATA = "metadata"
    CLOUD = "cloud"
    PRODUCTIVITY = "productivity"


class ToolStatus(str, Enum):
    """Lifecycle status of a tool."""

    AVAILABLE = "available"
    BETA = "beta"
    COMING_SOON = "coming_soon"
    DEPRECATED = "deprecated"


class ToolMetadata(BaseModel):
    """Metadata describing a single tool, served by the registry API."""

    id: str = Field(..., description="Unique, stable identifier for the tool.")
    name: str = Field(..., description="Human-readable display name.")
    description: str = Field(..., description="Short description of what the tool does.")
    category: ToolCategory
    icon: str = Field(..., description="Icon identifier (lucide-react icon name).")
    route: str = Field(..., description="Frontend route path for the tool.")
    version: str = Field(default="0.1.0")
    status: ToolStatus = Field(default=ToolStatus.COMING_SOON)
    tags: list[str] = Field(default_factory=list)


class ToolListResponse(BaseModel):
    """Response payload listing all registered tools."""

    tools: list[ToolMetadata]
    total: int


def is_tool_interactive(status: ToolStatus) -> bool:
    """Return True if a tool's UI should be reachable/clickable.

    Shared by API/service layers so "which statuses are usable" is
    defined in exactly one place (mirrored on the frontend by
    `lib/tool-status.ts`).
    """
    return status in (ToolStatus.AVAILABLE, ToolStatus.BETA)
