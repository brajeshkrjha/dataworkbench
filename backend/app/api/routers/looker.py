"""GCP Looker Utility endpoints.

Modules: Convert PBIP to LookML, Explore PBIP Structure, Preview LookML,
and Compare LookML Packages. All share the same extraction/parsing step
(``parse_pbip_upload``) - only what happens with the parsed data differs.
"""
import io

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.api.result_headers import LOOKER_RESULT_HEADERS
from app.core.exceptions import (
    BulkJobNotFoundError,
    BulkJobNotReadyError,
    EmptyFileError,
    FileTooLargeError,
)
from app.schemas.looker import (
    BulkDiscoverySummary,
    BulkJobStartResult,
    BulkJobStatusResult,
    BulkJobSummaryResult,
    BulkProjectFailure,
    BulkProjectSuccess,
    LookmlCompareResult,
    LookmlPreviewResult,
    PbipStructureResult,
)
from app.services.looker.bulk_job_store import get_job
from app.services.looker.bulk_service import build_bulk_report_markdown, start_bulk_conversion
from app.services.looker.compare_adapters import resolve_adapter
from app.services.looker.lookml_diff import diff_lookml_packages
from app.services.looker.pipeline import convert_pbip_to_lookml, parse_pbip_upload
from app.services.looker.preview_builder import build_lookml_preview
from app.services.looker.structure_explorer import build_pbip_structure

router = APIRouter(prefix="/tools/gcp-looker-utility", tags=["gcp-looker-utility"])

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
# A parent folder of many PBIP projects is naturally much larger than any one of them.
MAX_BULK_UPLOAD_BYTES = 1024 * 1024 * 1024

RESULT_HEADERS = LOOKER_RESULT_HEADERS


def _result_headers(result: dict) -> dict[str, str]:
    """Expose conversion metadata alongside the binary download."""
    return {
        "X-Looker-Project-Name": result["project_name"],
        "X-Looker-Views-Generated": str(result["views_generated"]),
        "X-Looker-Explores-Generated": str(result["explores_generated"]),
        "X-Looker-Relationships-Found": str(result["relationships_found"]),
        "X-Looker-Measures-Found": str(result["measures_found"]),
    }


def _read_upload(file: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> bytes:
    source_name = file.filename or "upload.zip"
    # Read only enough to enforce the existing limit; an oversized upload
    # must not first be duplicated in its entirety in application memory.
    upload_bytes = file.file.read(max_bytes + 1)

    if not upload_bytes:
        raise EmptyFileError(source_name)
    if len(upload_bytes) > max_bytes:
        raise FileTooLargeError(source_name, max_bytes)

    return upload_bytes


def _read_bulk_upload(file: UploadFile) -> bytes:
    return _read_upload(file, MAX_BULK_UPLOAD_BYTES)


@router.post(
    "/convert",
    summary="Convert a PBIP project ZIP into a LookML package",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"application/zip": {}},
            "description": (
                "The generated LookML package as a ZIP. Conversion metadata "
                "(LookerConversionResult fields) is returned in X-Looker-* headers."
            ),
        }
    },
)
def convert_pbip_project(
    file: UploadFile = File(
        ...,
        description="A ZIP archive of a PBIP project, containing the .pbip file, "
        "its <Name>.Report folder, and its <Name>.SemanticModel folder.",
    ),
) -> StreamingResponse:
    """Convert an uploaded PBIP project ZIP into a downloadable LookML package ZIP."""
    source_name = file.filename or "upload.zip"
    upload_bytes = _read_upload(file)

    result = convert_pbip_to_lookml(upload_bytes, source_name)

    return StreamingResponse(
        io.BytesIO(result["zip_bytes"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{result["output_file_name"]}"',
            **_result_headers(result),
        },
    )


@router.post(
    "/explore",
    summary="Explore a PBIP project's structure without opening Power BI Desktop",
    response_model=PbipStructureResult,
)
def explore_pbip_structure(
    file: UploadFile = File(..., description="A ZIP archive of a PBIP project."),
) -> PbipStructureResult:
    """Return tables, measures, relationships, roles, lineage and statistics for a PBIP project."""
    source_name = file.filename or "upload.zip"
    upload_bytes = _read_upload(file)

    pbip_file, report_data, model_data, clean_views = parse_pbip_upload(upload_bytes, source_name)
    structure = build_pbip_structure(report_data, model_data, clean_views)

    return PbipStructureResult(project_name=pbip_file.stem, **structure)


@router.post(
    "/preview",
    summary="Generate LookML and return it as structured data for in-browser preview",
    response_model=LookmlPreviewResult,
)
def preview_lookml_package(
    file: UploadFile = File(..., description="A ZIP archive of a PBIP project."),
) -> LookmlPreviewResult:
    """Convert a PBIP project the same way /convert does, but return structured LookML instead of a ZIP."""
    source_name = file.filename or "upload.zip"
    upload_bytes = _read_upload(file)

    pbip_file, _report_data, model_data, clean_views = parse_pbip_upload(upload_bytes, source_name)
    preview = build_lookml_preview(pbip_file, model_data, clean_views)

    return LookmlPreviewResult(**preview)


@router.post(
    "/compare",
    summary="Compare two PBIP projects and/or generated LookML packages",
    response_model=LookmlCompareResult,
)
def compare_lookml_packages(
    file_a: UploadFile = File(
        ..., description="A ZIP of a PBIP project or a generated LookML package (the 'previous' side)."
    ),
    file_b: UploadFile = File(
        ..., description="A ZIP of a PBIP project or a generated LookML package (the 'current' side)."
    ),
) -> LookmlCompareResult:
    """Auto-detect each upload's source type (PBIP project or LookML package), adapt both
    to the same LookML structure, and return a structural diff (views, explores, fields, joins).
    Supports all four combinations: PBIP vs PBIP, LookML vs LookML, and either mixed direction.
    """
    name_a = file_a.filename or "package-a.zip"
    name_b = file_b.filename or "package-b.zip"
    upload_a = _read_upload(file_a)
    upload_b = _read_upload(file_b)

    adapter_a = resolve_adapter(upload_a, name_a)
    adapter_b = resolve_adapter(upload_b, name_b)

    preview_a = adapter_a.build_preview(upload_a, name_a)
    preview_b = adapter_b.build_preview(upload_b, name_b)

    diff = diff_lookml_packages(preview_a, preview_b)

    return LookmlCompareResult(
        project_name_a=preview_a["project_name"],
        project_name_b=preview_b["project_name"],
        source_type_a=adapter_a.source_type,
        source_type_b=adapter_b.source_type,
        **diff,
    )


# ---- Bulk Conversion ----


def _job_or_404(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise BulkJobNotFoundError(job_id)
    return job


@router.post(
    "/bulk-convert",
    summary="Start a bulk PBIP -> LookML conversion job for a parent folder of many projects",
    response_model=BulkJobStartResult,
)
def start_bulk_convert(
    file: UploadFile = File(
        ...,
        description="A ZIP of a parent folder containing one or more PBIP project subfolders.",
    ),
) -> BulkJobStartResult:
    """Discovers every PBIP project in the upload, starts converting the valid ones in the
    background, and returns immediately with a job id plus the discovery summary so the UI
    can show 'Found / Valid / Invalid' right away and start polling for progress."""
    source_name = file.filename or "upload.zip"
    upload_bytes = _read_bulk_upload(file)

    job = start_bulk_conversion(upload_bytes, source_name)

    return BulkJobStartResult(job_id=job.job_id, discovery=BulkDiscoverySummary(**job.discovery))


@router.get(
    "/bulk-convert/{job_id}/status",
    summary="Poll progress for a running bulk conversion job",
    response_model=BulkJobStatusResult,
)
def get_bulk_convert_status(job_id: str) -> BulkJobStatusResult:
    job = _job_or_404(job_id)
    percent = 100.0 if job.status == "completed" else (0.0 if job.total == 0 else round(100 * job.processed / job.total, 1))

    return BulkJobStatusResult(
        job_id=job.job_id,
        status=job.status,
        total=job.total,
        processed=job.processed,
        current_project=job.current_project,
        percent=percent,
    )


@router.get(
    "/bulk-convert/{job_id}/summary",
    summary="Get the result summary for a bulk conversion job",
    response_model=BulkJobSummaryResult,
)
def get_bulk_convert_summary(job_id: str) -> BulkJobSummaryResult:
    job = _job_or_404(job_id)

    return BulkJobSummaryResult(
        job_id=job.job_id,
        status=job.status,
        discovery=BulkDiscoverySummary(**job.discovery),
        processed=job.processed,
        successful=len(job.successes),
        failed=len(job.failures),
        successes=[BulkProjectSuccess(**s) for s in job.successes],
        failures=[BulkProjectFailure(**f) for f in job.failures],
    )


@router.get(
    "/bulk-convert/{job_id}/download",
    summary="Download the completed bulk conversion output ZIP",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/zip": {}}}},
)
def download_bulk_convert(job_id: str) -> StreamingResponse:
    job = _job_or_404(job_id)
    if job.status != "completed" or job.zip_bytes is None:
        raise BulkJobNotReadyError(job_id, job.status)

    return StreamingResponse(
        io.BytesIO(job.zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{job.output_file_name}"'},
    )


@router.get(
    "/bulk-convert/{job_id}/report",
    summary="Download a Markdown summary report for a bulk conversion job",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/markdown": {}}}},
)
def download_bulk_convert_report(job_id: str) -> StreamingResponse:
    job = _job_or_404(job_id)
    report_text = build_bulk_report_markdown(job)

    return StreamingResponse(
        io.BytesIO(report_text.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="Bulk_Conversion_Report.md"'},
    )
