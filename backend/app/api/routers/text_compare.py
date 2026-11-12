"""Text Compare Utility endpoints: a single stateless compare + export
pair, accepting uploads, pasted text, or a mix of both per side."""
from fastapi import APIRouter, Body, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response

from app.api.dependencies.services import get_text_compare_service_singleton
from app.core.config import Settings, get_settings
from app.core.exceptions import EmptyFileError, FileTooLargeError
from app.schemas.text_compare import ComparisonExportFormat, ComparisonInputType, ComparisonResult
from app.services.text_compare.export import render_export
from app.services.text_compare.service import TextCompareService

router = APIRouter(prefix="/tools/text-compare-utility", tags=["text-compare-utility"])


def _resolve_side(
    file: UploadFile | None,
    text: str | None,
    fallback_name: str,
    settings: Settings,
) -> tuple[str, str]:
    """Returns (content, name) for one side, accepting either an
    uploaded file or pasted text so upload/paste/mixed all work."""
    if file is not None and file.filename:
        raw = file.file.read()
        if len(raw) == 0:
            raise EmptyFileError(file.filename)
        if len(raw) > settings.max_upload_bytes:
            raise FileTooLargeError(file.filename, settings.max_upload_bytes)
        return raw.decode("utf-8", errors="replace"), file.filename

    if text is not None and text.strip() != "":
        return text, fallback_name

    raise EmptyFileError(fallback_name)


@router.post(
    "/compare",
    summary="Compare two sources (upload, paste, or mixed) with auto type detection",
    response_model=ComparisonResult,
)
def compare(
    file_a: UploadFile | None = File(default=None, description="Upload for Version A."),
    file_b: UploadFile | None = File(default=None, description="Upload for Version B."),
    text_a: str | None = Form(default=None, description="Pasted content for Version A."),
    text_b: str | None = Form(default=None, description="Pasted content for Version B."),
    type_override: ComparisonInputType | None = Form(default=None, description="Force a specific comparison type."),
    ignore_case: bool = Form(default=False, description="Treat upper/lower case as equal."),
    ignore_whitespace: bool = Form(default=False, description="Ignore leading/trailing/repeated whitespace."),
    service: TextCompareService = Depends(get_text_compare_service_singleton),
    settings: Settings = Depends(get_settings),
) -> ComparisonResult:
    content_a, name_a = _resolve_side(file_a, text_a, "Version A", settings)
    content_b, name_b = _resolve_side(file_b, text_b, "Version B", settings)

    return service.compare(content_a, content_b, name_a, name_b, type_override, ignore_case, ignore_whitespace)


@router.post(
    "/compare/export",
    summary="Export a comparison result as a Markdown or CSV report",
)
def export_comparison(
    export_format: ComparisonExportFormat = Query(..., alias="format"),
    result: ComparisonResult = Body(...),
) -> Response:
    content, media_type = render_export(result, export_format)
    extension = "md" if export_format == ComparisonExportFormat.MARKDOWN else "csv"
    file_name = f"text-comparison.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
