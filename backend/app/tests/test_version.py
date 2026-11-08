"""Tests for the version endpoint."""
from fastapi.testclient import TestClient


def test_version_returns_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/version")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "DataWorkbench"
    assert body["tagline"] == "Everyday Tools for Data Engineers"
    assert body["api_version"] == "v1"
