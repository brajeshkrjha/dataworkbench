"""Service layer for tool registry operations (business logic, not HTTP)."""
from app.registry.tools import get_all_tools, get_tool_by_id
from app.schemas.tools import ToolListResponse, ToolMetadata


class ToolService:
    """Encapsulates business logic around the tool registry."""

    def list_tools(self) -> ToolListResponse:
        """Return all registered tools with a total count."""
        tools = get_all_tools()
        return ToolListResponse(tools=tools, total=len(tools))

    def get_tool(self, tool_id: str) -> ToolMetadata:
        """Return a single tool's metadata by id."""
        return get_tool_by_id(tool_id)


def get_tool_service() -> ToolService:
    """FastAPI dependency provider for ToolService."""
    return ToolService()
