"""Auto-discovers and aggregates tool definitions.

Scans `app.registry.definitions` for modules exposing a module-level
`TOOL: ToolMetadata` constant and aggregates them into a single list.
Adding a tool never requires editing this file - only adding a new
module under `definitions/`.
"""
import importlib
import pkgutil
from functools import lru_cache

from app.registry import definitions
from app.schemas.tools import ToolMetadata


class DuplicateToolIdError(ValueError):
    """Raised when two tool definitions declare the same id."""


def _discover_tool_modules() -> list[ToolMetadata]:
    """Import every module under `definitions/` and collect its `TOOL`."""
    tools: list[ToolMetadata] = []
    for module_info in pkgutil.iter_modules(definitions.__path__):
        module = importlib.import_module(f"{definitions.__name__}.{module_info.name}")
        tool = getattr(module, "TOOL", None)
        if tool is None:
            continue
        if not isinstance(tool, ToolMetadata):
            raise TypeError(
                f"Module '{module.__name__}' exposes 'TOOL' that is not a ToolMetadata instance."
            )
        tools.append(tool)
    return tools


@lru_cache
def load_tools() -> tuple[ToolMetadata, ...]:
    """Load, validate, and cache all tool definitions."""
    tools = _discover_tool_modules()

    seen_ids: set[str] = set()
    for tool in tools:
        if tool.id in seen_ids:
            raise DuplicateToolIdError(f"Duplicate tool id detected: '{tool.id}'")
        seen_ids.add(tool.id)

    return tuple(sorted(tools, key=lambda tool: tool.id))
