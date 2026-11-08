"""Tests for the tool registry endpoints."""
from fastapi.testclient import TestClient


def test_list_tools_returns_registered_tools(client: TestClient) -> None:
    response = client.get("/api/v1/tools")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(body["tools"])
    assert body["total"] > 0
    assert "parquet-utility" in {tool["id"] for tool in body["tools"]}


def test_get_tool_by_id_returns_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/tools/parquet-utility")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "parquet-utility"
    assert body["name"] == "Parquet Utility"


def test_get_tool_by_unknown_id_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/tools/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["error"] == "ToolNotFoundError"
