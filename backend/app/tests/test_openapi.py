"""Keep runtime contracts and the frontend's source snapshot synchronized."""
import json

import pytest

from app.main import app
from scripts import export_openapi


def test_openapi_snapshot_matches_runtime_contract():
    snapshot = json.loads(export_openapi.OUTPUT_PATH.read_text(encoding="utf-8"))
    assert snapshot == app.openapi(), "Regenerate the OpenAPI snapshot and frontend API types"


def test_check_accepts_equivalent_json_without_rewriting(tmp_path, monkeypatch, capsys):
    output = tmp_path / "schema.json"
    output.write_text(json.dumps(app.openapi(), indent=4, sort_keys=True), encoding="utf-8")
    original = output.read_bytes()
    monkeypatch.setattr(export_openapi, "OUTPUT_PATH", output)

    assert export_openapi.main(["--check"]) == 0
    assert output.read_bytes() == original
    assert "up to date" in capsys.readouterr().out


@pytest.mark.parametrize("content", [None, "invalid json", "{}"])
def test_check_rejects_missing_invalid_or_stale_snapshots_without_writing(
    tmp_path, monkeypatch, capsys, content
):
    output = tmp_path / "schema.json"
    if content is not None:
        output.write_text(content, encoding="utf-8")
    monkeypatch.setattr(export_openapi, "OUTPUT_PATH", output)

    assert export_openapi.main(["--check"]) == 1
    assert capsys.readouterr().err
    if content is None:
        assert not output.exists()
    else:
        assert output.read_text(encoding="utf-8") == content


def test_default_mode_still_exports_snapshot(tmp_path, monkeypatch):
    output = tmp_path / "schema.json"
    monkeypatch.setattr(export_openapi, "OUTPUT_PATH", output)

    assert export_openapi.main([]) == 0
    assert json.loads(output.read_text(encoding="utf-8")) == app.openapi()