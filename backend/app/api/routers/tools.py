"""Tool registry endpoints."""
from fastapi import APIRouter, Depends

from app.api.dependencies.services import get_tool_service_singleton
from app.schemas.tools import ToolListResponse, ToolMetadata
from app.services.tool_service import ToolService

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("", response_model=ToolListResponse, summary="List all tools")
def list_tools(service: ToolService = Depends(get_tool_service_singleton)) -> ToolListResponse:
    """Return metadata for every tool registered in the Tool Registry."""
    return service.list_tools()


@router.get("/{tool_id}", response_model=ToolMetadata, summary="Get tool by id")
def get_tool(
    tool_id: str, service: ToolService = Depends(get_tool_service_singleton)
) -> ToolMetadata:
    """Return metadata for a single tool by its id."""
    return service.get_tool(tool_id)
