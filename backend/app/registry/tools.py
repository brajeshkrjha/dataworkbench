"""Tool Registry facade.

Public API used by services/tests. Aggregation itself lives in
`loader.py`, which auto-discovers per-tool modules under `definitions/`.
Adding a tool means adding one module to `definitions/` - this file
never needs to change.
"""
from app.core.exceptions import ToolNotFoundError
from app.registry.loader import load_tools
from app.schemas.tools import ToolMetadata

_runtime_registered: dict[str, ToolMetadata] = {}


def register_tool(tool: ToolMetadata) -> None:
    """Register an additional tool at runtime (e.g. from tests/plugins).

    Prefer adding a module under `registry/definitions/` for real tools;
    this exists for runtime/test scenarios only.
    """
    if tool.id in _runtime_registered or any(tool.id == t.id for t in load_tools()):
        raise ValueError(f"Tool with id '{tool.id}' is already registered.")
    _runtime_registered[tool.id] = tool


def get_all_tools() -> list[ToolMetadata]:
    """Return all registered tools (definitions + any runtime-registered)."""
    return [*load_tools(), *_runtime_registered.values()]


def get_tool_by_id(tool_id: str) -> ToolMetadata:
    """Return a single tool by id, or raise ToolNotFoundError."""
    for tool in get_all_tools():
        if tool.id == tool_id:
            return tool
    raise ToolNotFoundError(tool_id)
