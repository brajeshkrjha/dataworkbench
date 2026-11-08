"""Tests for bulk PBIP -> LookML conversion (Discover -> Validate -> Convert -> Package)."""
import io
import time
import zipfile

from app.services.looker.bulk_job_store import create_job
from app.tests.test_looker import _minimal_pbip_project, _prefixed, _zip_bytes

BULK_START_URL = "/api/v1/tools/gcp-looker-utility/bulk-convert"


def _bulk_zip(projects: dict[str, dict[str, str]]) -> bytes:
    """Builds a parent-folder ZIP containing several isolated PBIP project subfolders,
    e.g. {"sample_pbip1": {...files...}, "sample_pbip2": {...files...}}."""
    files: dict[str, str] = {}
    for folder, project_files in projects.items():
        files.update(_prefixed(project_files, f"{folder}/"))
    return _zip_bytes(files)


def _poll_until_done(client, job_id: str, timeout_seconds: float = 5.0) -> dict:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = client.get(f"{BULK_START_URL}/{job_id}/status")
        assert response.status_code == 200
        body = response.json()
        if body["status"] in ("completed", "failed"):
            return body
        time.sleep(0.02)
    raise AssertionError(f"Job {job_id} did not finish within {timeout_seconds}s")


def test_bulk_convert_discovers_all_valid_projects(client):
    upload = _bulk_zip(
        {
            "sample_pbip1": _minimal_pbip_project("Project1"),
            "sample_pbip2": _minimal_pbip_project("Project2"),
            "sample_pbip3": _minimal_pbip_project("Project3"),
        }
    )
    response = client.post(BULK_START_URL, files={"file": ("parent.zip", upload, "application/zip")})
    assert response.status_code == 200
    body = response.json()
    assert body["discovery"]["found"] == 3
    assert body["discovery"]["valid"] == 3
    assert body["discovery"]["invalid"] == 0
    assert "job_id" in body


def test_bulk_convert_continues_past_invalid_projects(client):
    """Ignore invalid folders, detect corrupted projects, keep processing the rest."""
    valid_a = _minimal_pbip_project("ProjectA")
    valid_b = _minimal_pbip_project("ProjectB")

    missing_semantic_model = _minimal_pbip_project("ProjectC")
    del missing_semantic_model["ProjectC.SemanticModel/definition/model.tmdl"]
    del missing_semantic_model["ProjectC.SemanticModel/definition/relationships.tmdl"]
    del missing_semantic_model["ProjectC.SemanticModel/definition.pbism"]

    upload = _bulk_zip(
        {
            "sample_pbip_a": valid_a,
            "sample_pbip_b": valid_b,
            "sample_pbip_c": missing_semantic_model,
        }
    )
    response = client.post(BULK_START_URL, files={"file": ("parent.zip", upload, "application/zip")})
    assert response.status_code == 200
    body = response.json()
    assert body["discovery"]["found"] == 3
    assert body["discovery"]["valid"] == 2
    assert body["discovery"]["invalid"] == 1
    assert body["discovery"]["invalid_projects"][0]["project_name"] == "ProjectC"
    assert "semanticmodel" in body["discovery"]["invalid_projects"][0]["reason"].lower()

    status_body = _poll_until_done(client, body["job_id"])
    assert status_body["status"] == "completed"
    assert status_body["total"] == 2
    assert status_body["processed"] == 2
    assert status_body["percent"] == 100.0


def test_bulk_convert_ignores_folders_with_no_pbip_at_all(client):
    """A subfolder with unrelated junk (no .pbip anywhere) is simply not discovered."""
    upload = _bulk_zip({"sample_pbip1": _minimal_pbip_project("Project1")})
    upload_files = {"random_folder/readme.txt": "nothing to see here"}
    combined = zipfile.ZipFile(io.BytesIO(upload))
    files = {name: combined.read(name).decode("utf-8") for name in combined.namelist()}
    files.update(upload_files)
    response = client.post(
        BULK_START_URL, files={"file": ("parent.zip", _zip_bytes(files), "application/zip")}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["discovery"]["found"] == 1
    assert body["discovery"]["valid"] == 1


def test_bulk_convert_progress_and_summary_report(client):
    upload = _bulk_zip(
        {
            "sample_pbip1": _minimal_pbip_project("Project1"),
            "sample_pbip2": _minimal_pbip_project("Project2"),
        }
    )
    start = client.post(BULK_START_URL, files={"file": ("parent.zip", upload, "application/zip")})
    job_id = start.json()["job_id"]

    _poll_until_done(client, job_id)

    summary = client.get(f"{BULK_START_URL}/{job_id}/summary")
    assert summary.status_code == 200
    summary_body = summary.json()
    assert summary_body["successful"] == 2
    assert summary_body["failed"] == 0
    assert {s["project_name"] for s in summary_body["successes"]} == {"Project1", "Project2"}

    report = client.get(f"{BULK_START_URL}/{job_id}/report")
    assert report.status_code == 200
    assert "text/markdown" in report.headers["content-type"]
    assert "Bulk LookML Conversion Report" in report.text
    assert "Project1" in report.text


def test_bulk_convert_download_produces_isolated_project_zip(client):
    upload = _bulk_zip(
        {
            "sample_pbip1": _minimal_pbip_project("Project1"),
            "sample_pbip2": _minimal_pbip_project("Project2"),
        }
    )
    start = client.post(BULK_START_URL, files={"file": ("parent.zip", upload, "application/zip")})
    job_id = start.json()["job_id"]
    _poll_until_done(client, job_id)

    download = client.get(f"{BULK_START_URL}/{job_id}/download")
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/zip"

    package = zipfile.ZipFile(io.BytesIO(download.content))
    names = package.namelist()
    assert any(name.startswith("Generated_LookML_Projects/Project1/") and name.endswith(".model.lkml") for name in names)
    assert any(name.startswith("Generated_LookML_Projects/Project2/") and name.endswith(".model.lkml") for name in names)
    assert any("Generated_LookML_Projects/Project1/views/" in name for name in names)
    assert any("Generated_LookML_Projects/Project2/views/" in name for name in names)
    # Isolation: Project1's views must never leak into Project2's folder and vice versa.
    project1_files = {n for n in names if n.startswith("Generated_LookML_Projects/Project1/")}
    project2_files = {n for n in names if n.startswith("Generated_LookML_Projects/Project2/")}
    assert project1_files.isdisjoint(project2_files)


def test_bulk_convert_download_before_completion_returns_409(client):
    # Control the state instead of racing a background worker on a tiny fixture.
    job = create_job()
    job.status = "processing"
    download = client.get(f"{BULK_START_URL}/{job.job_id}/download")
    assert download.status_code == 409
    assert download.json()["error"] == "BulkJobNotReadyError"


def test_bulk_convert_unknown_job_returns_404(client):
    response = client.get(f"{BULK_START_URL}/does-not-exist/status")
    assert response.status_code == 404


def test_bulk_convert_no_projects_found_completes_with_empty_zip(client):
    upload = _zip_bytes({"random_folder/readme.txt": "nothing pbip-related here"})
    response = client.post(BULK_START_URL, files={"file": ("parent.zip", upload, "application/zip")})
    assert response.status_code == 200
    body = response.json()
    assert body["discovery"]["found"] == 0
    assert body["discovery"]["valid"] == 0

    status_body = _poll_until_done(client, body["job_id"])
    assert status_body["status"] == "completed"
    assert status_body["total"] == 0

    download = client.get(f"{BULK_START_URL}/{body['job_id']}/download")
    assert download.status_code == 200
    package = zipfile.ZipFile(io.BytesIO(download.content))
    assert package.namelist() == []


def test_bulk_convert_empty_upload_returns_400(client):
    response = client.post(BULK_START_URL, files={"file": ("parent.zip", b"", "application/zip")})
    assert response.status_code == 400


def test_bulk_convert_invalid_zip_returns_400(client):
    response = client.post(BULK_START_URL, files={"file": ("parent.zip", b"not a zip", "application/zip")})
    assert response.status_code == 400
