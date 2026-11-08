"""Validation tests for the modular Tool Registry."""
import pytest

from app.core.exceptions import ToolNotFoundError
from app.registry.loader import load_tools
from app.registry.tools import get_all_tools, get_tool_by_id
from app.schemas.tools import ToolMetadata


def test_load_tools_returns_registered_tools() -> None:
    tools = load_tools()
    assert len(tools) > 0
    assert all(isinstance(tool, ToolMetadata) for tool in tools)


def test_all_tool_ids_are_unique() -> None:
    tools = get_all_tools()
    ids = [tool.id for tool in tools]
    assert len(ids) == len(set(ids))


def test_all_tools_have_required_fields() -> None:
    for tool in get_all_tools():
        assert tool.id
        assert tool.name
        assert tool.description
        assert tool.route.startswith("/tools/")
        assert tool.icon


def test_get_tool_by_id_matches_loaded_tool() -> None:
    first = get_all_tools()[0]
    assert get_tool_by_id(first.id).id == first.id


def test_get_tool_by_id_raises_when_not_found() -> None:
    with pytest.raises(ToolNotFoundError):
        get_tool_by_id("does-not-exist")


def test_load_tools_is_cached_and_stable() -> None:
    assert load_tools() == load_tools()
