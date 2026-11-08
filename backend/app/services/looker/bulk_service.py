"""Orchestrates a bulk PBIP -> LookML conversion job end to end:
upload -> discovery -> validation -> conversion -> packaging, with progress
tracked on a `BulkJob` so the frontend can poll instead of blocking on one
long request. Discovery runs synchronously (cheap - filesystem scan only);
conversion runs on a background thread so the HTTP response returns
immediately with the discovery summary and a job id to poll.
"""
import logging
import shutil
import threading
from contextlib import ExitStack

from app.services.looker.bulk_conversion import convert_discovered_project
from app.services.looker.bulk_discovery import discover_projects, extract_bulk_upload
from app.services.looker.bulk_job_store import BulkJob, create_job
from app.services.looker.lookml_packager import build_bulk_lookml_zip

BULK_OUTPUT_FILE_NAME = "Generated_LookML_Projects.zip"
logger = logging.getLogger(__name__)


def _run_conversion(job: BulkJob, extract_root, valid_projects) -> None:
    results: list[tuple[str, str, list]] = []
    try:
        for project in valid_projects:
            job.current_project = project.project_name
            try:
                model_text, counts, _views_unused = convert_discovered_project(project)
                results.append((project.project_name, model_text, _views_unused))
                job.successes.append(
                    {
                        "project_name": project.project_name,
                        "views_generated": counts.get("views", 0),
                        "explores_generated": counts.get("explores", 0),
                    }
                )
            except Exception as exc:
                logger.exception("Bulk project conversion failed (job_id=%s)", job.job_id)
                job.failures.append({"project_name": project.project_name, "reason": str(exc)})
            finally:
                job.processed += 1

        job.current_project = None
        job.zip_bytes = build_bulk_lookml_zip(results)
        job.output_file_name = BULK_OUTPUT_FILE_NAME
        job.status = "completed"
    except Exception as exc:
        logger.exception("Bulk conversion job failed (job_id=%s)", job.job_id)
        job.status = "failed"
        job.error = str(exc)
    finally:
        shutil.rmtree(extract_root, ignore_errors=True)


def start_bulk_conversion(upload_bytes: bytes, upload_name: str) -> BulkJob:
    """Extracts the upload, discovers every PBIP project in it, and starts
    background conversion of the valid ones. Returns the job immediately with
    its discovery summary already populated."""
    with ExitStack() as cleanup:
        extract_root = extract_bulk_upload(upload_bytes, upload_name)
        cleanup.callback(shutil.rmtree, extract_root, ignore_errors=True)
        projects = discover_projects(extract_root)
        valid_projects = [p for p in projects if p.valid]
        invalid_projects = [p for p in projects if not p.valid]

        job = create_job()
        job.total = len(valid_projects)
        job.discovery = {
            "found": len(projects),
            "valid": len(valid_projects),
            "invalid": len(invalid_projects),
            "invalid_projects": [{"project_name": p.project_name, "reason": p.reason} for p in invalid_projects],
        }

        if not valid_projects:
            job.status = "completed"
            job.zip_bytes = build_bulk_lookml_zip([])
            job.output_file_name = BULK_OUTPUT_FILE_NAME
            return job

        job.status = "processing"
        thread = threading.Thread(target=_run_conversion, args=(job, extract_root, valid_projects), daemon=True)
        thread.start()
        # Transfer ownership only after startup succeeds; the worker's finally
        # block handles cleanup from this point onward.
        cleanup.pop_all()
        return job


def build_bulk_report_markdown(job: BulkJob) -> str:
    """A concise, downloadable summary report for a completed (or in-progress) job."""
    discovery = job.discovery or {"found": 0, "valid": 0, "invalid": 0, "invalid_projects": []}
    lines = [
        "# Bulk LookML Conversion Report",
        "",
        f"**Job ID:** {job.job_id}",
        f"**Status:** {job.status}",
        "",
        "## Discovery",
        f"- Projects found: {discovery['found']}",
        f"- Valid: {discovery['valid']}",
        f"- Invalid: {discovery['invalid']}",
        "",
        "## Conversion Results",
        f"- Processed: {job.processed} / {job.total}",
        f"- Successful: {len(job.successes)}",
        f"- Failed: {len(job.failures)}",
        "",
        "## Successful Projects",
    ]
    if job.successes:
        for success in job.successes:
            lines.append(
                f"- **{success['project_name']}** - {success['views_generated']} views, "
                f"{success['explores_generated']} explores"
            )
    else:
        lines.append("- None")
    lines += [
        "",
        "## Failures",
    ]
    all_failures = [{"project_name": p["project_name"], "reason": p["reason"]} for p in discovery["invalid_projects"]]
    all_failures += job.failures
    if all_failures:
        for failure in all_failures:
            lines.append(f"- **{failure['project_name']}** - {failure['reason']}")
    else:
        lines.append("- None")

    return "\n".join(lines) + "\n"
