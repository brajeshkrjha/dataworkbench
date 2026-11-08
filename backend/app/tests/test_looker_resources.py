"""Failure-path ownership and bounded upload reads for Looker tools."""
import io
import zipfile
from pathlib import Path

import pytest
from fastapi import UploadFile

from app.api.routers.looker import _read_upload
from app.core.exceptions import EmptyFileError, FileTooLargeError
from app.services.looker import bulk_discovery, bulk_service
from app.services.looker.lookml_builder import _unique_field_name
from app.tests.test_looker import _zip_bytes


@pytest.mark.parametrize("content", [b"1234", b"12"])
def test_upload_preserves_bytes_at_or_below_limit(content):
    assert _read_upload(UploadFile(filename="project.zip", file=io.BytesIO(content)), 4) == content


def test_oversized_upload_stops_reading_after_limit_plus_one():
    source = io.BytesIO(b"x" * 100)
    with pytest.raises(FileTooLargeError):
        _read_upload(UploadFile(filename="project.zip", file=source), 4)
    assert source.tell() == 5


def test_empty_upload_keeps_existing_error():
    with pytest.raises(EmptyFileError):
        _read_upload(UploadFile(filename="project.zip", file=io.BytesIO()), 4)


def test_extraction_cleans_up_after_non_zip_io_failure(tmp_path, monkeypatch):
    extract_root = tmp_path / "extracted"
    extract_root.mkdir()
    monkeypatch.setattr(bulk_discovery.tempfile, "mkdtemp", lambda **kwargs: str(extract_root))

    def fail_extract(*args, **kwargs):
        (extract_root / "partial").write_bytes(b"partial")
        raise OSError("Disk full")

    monkeypatch.setattr(zipfile.ZipFile, "extract", fail_extract)
    with pytest.raises(OSError, match="Disk full"):
        bulk_discovery.extract_bulk_upload(_zip_bytes({"data": "content"}), "project.zip")
    assert not extract_root.exists()


@pytest.mark.parametrize("failure_stage", ["discovery", "packaging", "thread_start"])
def test_startup_failure_cleans_extracted_project(tmp_path, monkeypatch, failure_stage):
    extract_root = tmp_path / "extracted"
    extract_root.mkdir()
    monkeypatch.setattr(bulk_service, "extract_bulk_upload", lambda *args: extract_root)

    def fail(*args, **kwargs):
        raise RuntimeError("Startup failed")

    if failure_stage == "discovery":
        monkeypatch.setattr(bulk_service, "discover_projects", fail)
    elif failure_stage == "packaging":
        monkeypatch.setattr(bulk_service, "discover_projects", lambda *args: [])
        monkeypatch.setattr(bulk_service, "build_bulk_lookml_zip", fail)
    else:
        project = bulk_discovery.DiscoveredProject(Path("Sales.pbip"), "Sales", None, None, True, None)
        monkeypatch.setattr(bulk_service, "discover_projects", lambda *args: [project])
        monkeypatch.setattr(bulk_service.threading.Thread, "start", fail)

    with pytest.raises(RuntimeError, match="Startup failed"):
        bulk_service.start_bulk_conversion(b"zip", "project.zip")
    assert not extract_root.exists()


def test_field_name_collision_registry_is_shared_within_but_not_between_views():
    first_view: set[str] = set()
    assert _unique_field_name("Region", first_view) == "region"
    assert _unique_field_name("Region#", first_view) == "region_2"
    assert _unique_field_name("REGION", first_view) == "region_3"
    assert _unique_field_name("Region", set()) == "region"