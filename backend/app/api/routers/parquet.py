"""Parquet Utility endpoints.

Future Parquet Utility modules (reader, schema viewer, metadata
explorer, ...) register their endpoints on this router.
"""
import json
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import ValidationError
from starlette.background import BackgroundTask

from app.api.dependencies.services import (
    get_parquet_conversion_service_singleton,
    get_parquet_reader_service_singleton,
    get_parquet_schema_comparison_service_singleton,
)
from app.api.result_headers import PARQUET_RESULT_HEADERS
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    EmptyFileError,
    FileParseError,
    FileTooLargeError,
    UnsupportedFileTypeError,
)
from app.schemas.parquet import (
    CSV_DELIMITER_CHARS,
    CSV_QUOTING_STYLES,
    DEFAULT_COMPRESSION,
    DEFAULT_CSV_DELIMITER,
    DEFAULT_CSV_QUOTING,
    ColumnProfile,
    ColumnSchema,
    ColumnTypeOverride,
    ComparisonExportFormat,
    CompressionCodec,
    ConversionResult,
    CsvDelimiter,
    CsvQuoting,
    MappedDataType,
    ParquetFileMetadata,
    ParquetRowPage,
    ParquetSample,
    ParquetStatistics,
    ParquetToCsvResult,
    ParquetUploadResult,
    SampleMode,
    SchemaComparisonResult,
    SchemaInspectionResult,
    StorageAnalysis,
)
from app.services.parquet.comparison_export import render_export
from app.services.parquet.conversion_service import ParquetConversionService, cleanup_output
from app.services.parquet.reader_service import ParquetReaderService
from app.services.parquet.schema_comparison_service import ParquetSchemaComparisonService
from app.utils.file_utils import create_temp_file, delete_quietly, get_extension, spool_to_temp_file

router = APIRouter(prefix="/tools/parquet-utility", tags=["parquet-utility"])

RESULT_HEADERS = PARQUET_RESULT_HEADERS


def _result_headers(result: ConversionResult) -> dict[str, str]:
    """Expose conversion metadata alongside the binary download."""
    return {
        "X-Conversion-File-Name": result.file_name,
        "X-Conversion-Source-Format": result.source_format.value,
        "X-Conversion-Compression": result.compression.value,
        "X-Conversion-Row-Count": str(result.row_count),
        "X-Conversion-Column-Count": str(result.column_count),
        "X-Conversion-Source-Bytes": str(result.source_bytes),
        "X-Conversion-Output-Bytes": str(result.output_bytes),
        "X-Conversion-Schema-Summary": json.dumps(result.schema_summary),
    }


def _csv_result_headers(result: ParquetToCsvResult) -> dict[str, str]:
    """Expose CSV export metadata alongside the binary download."""
    return {
        "X-Conversion-File-Name": result.file_name,
        "X-Conversion-Row-Count": str(result.row_count),
        "X-Conversion-Column-Count": str(result.column_count),
        "X-Conversion-Source-Bytes": str(result.source_bytes),
        "X-Conversion-Output-Bytes": str(result.output_bytes),
    }


@router.post(
    "/convert",
    summary="Convert a supported file to parquet",
    response_class=FileResponse,
    responses={
        200: {
            "content": {"application/vnd.apache.parquet": {}},
            "description": (
                "The generated parquet file. Conversion metadata "
                "(ConversionResult fields) is returned in X-Conversion-* headers."
            ),
        }
    },
)
def convert_to_parquet(
    file: UploadFile = File(..., description="File to convert (CSV, TSV, JSON, Excel, XML, Avro, or ORC)."),
    compression: CompressionCodec = Form(
        default=DEFAULT_COMPRESSION, description="Parquet compression codec."
    ),
    output_file_name: str | None = Form(
        default=None, description="Optional custom output file name (without extension)."
    ),
    column_types: str | None = Form(
        default=None,
        description=(
            "Optional JSON-encoded list of column datatype overrides: "
            '[{"column": "Amount", "data_type": "decimal"}, ...]. '
            "Omit to keep automatic type inference (currently CSV/TSV only)."
        ),
    ),
    service: ParquetConversionService = Depends(get_parquet_conversion_service_singleton),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    """Convert an uploaded file into a downloadable parquet file."""
    source_name = file.filename or "upload"
    service.detect_format(source_name)
    output_name = service.resolve_output_name(source_name, output_file_name)
    column_overrides = _parse_column_overrides(source_name, column_types)

    source_path, source_bytes = spool_to_temp_file(file.file)
    output_path: Path | None = None

    try:
        if source_bytes == 0:
            raise EmptyFileError(source_name)
        if source_bytes > settings.max_upload_bytes:
            raise FileTooLargeError(source_name, settings.max_upload_bytes)

        output_path = create_temp_file(suffix=".parquet")
        result = service.convert(
            source_path=source_path,
            source_name=source_name,
            source_bytes=source_bytes,
            output_path=output_path,
            output_name=output_name,
            compression=compression,
            column_overrides=column_overrides,
        )
    except Exception:
        if output_path is not None:
            delete_quietly(output_path)
        raise
    finally:
        delete_quietly(source_path)

    return FileResponse(
        path=output_path,
        media_type="application/vnd.apache.parquet",
        filename=output_name,
        headers=_result_headers(result),
        background=BackgroundTask(cleanup_output, output_path),
    )


def _parse_column_overrides(
    source_name: str, column_types: str | None
) -> dict[str, MappedDataType] | None:
    """Parse the optional `column_types` form field into an overrides map."""
    if not isinstance(column_types, str) or not column_types.strip():
        return None
    try:
        raw = json.loads(column_types)
        overrides = [ColumnTypeOverride(**item) for item in raw]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise FileParseError(source_name, f"Invalid column_types payload: {exc}") from exc
    return {item.column: item.data_type for item in overrides}


@router.post(
    "/convert/inspect",
    summary="Inspect a file's schema before conversion",
    response_model=SchemaInspectionResult,
)
def inspect_schema(
    file: UploadFile = File(..., description="CSV or TSV file to inspect (sampled, not fully read)."),
    service: ParquetConversionService = Depends(get_parquet_conversion_service_singleton),
    settings: Settings = Depends(get_settings),
) -> SchemaInspectionResult:
    """Sample an uploaded file and report auto-detected per-column datatypes.

    Lets the Convert Files UI show detected types, sample values, and null
    rates before conversion, so users can review and override datatypes.
    """
    source_name = file.filename or "upload"
    service.detect_format(source_name)
    source_path, source_bytes = spool_to_temp_file(file.file)
    try:
        if source_bytes == 0:
            raise EmptyFileError(source_name)
        if source_bytes > settings.max_upload_bytes:
            raise FileTooLargeError(source_name, settings.max_upload_bytes)
        return service.inspect_schema(source_path, source_name)
    finally:
        delete_quietly(source_path)


# ---- Parquet -> CSV export ("From Parquet" direction, Convert Files) ----
# Two-step like Reader/Analyzer (upload once, then act by file_id) rather
# than single-shot like `convert_to_parquet`: the upload step reuses
# ParquetReaderService's own session store, so the returned `file_id` can
# also preview rows via `/reader/{file_id}/rows` and be opened directly in
# Parquet Reader afterwards - no duplicate parsing or second upload.


@router.post(
    "/convert/from-parquet/upload",
    summary="Upload a parquet file to convert to CSV",
    response_model=ParquetUploadResult,
)
def upload_for_csv_export(
    file: UploadFile = File(..., description="A .parquet file to convert to CSV."),
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
    settings: Settings = Depends(get_settings),
) -> ParquetUploadResult:
    source_name = file.filename or "upload"
    source_path = _validate_and_spool(file, settings)

    file_id = service.register_upload(source_path, source_name)
    return ParquetUploadResult(
        file_id=file_id,
        metadata=service.get_metadata(file_id),
        columns=service.get_schema(file_id),
    )


@router.post(
    "/convert/from-parquet/{file_id}/export",
    summary="Export an uploaded parquet file as CSV",
    response_class=FileResponse,
    responses={
        200: {
            "content": {"text/csv": {}},
            "description": (
                "The generated CSV file. Export metadata is returned in "
                "X-Conversion-* headers."
            ),
        }
    },
)
def export_parquet_to_csv(
    file_id: str,
    delimiter: CsvDelimiter = Form(default=DEFAULT_CSV_DELIMITER, description="CSV field delimiter."),
    include_header: bool = Form(default=True, description="Whether to include a header row."),
    quoting: CsvQuoting = Form(default=DEFAULT_CSV_QUOTING, description="CSV quoting style."),
    output_file_name: str | None = Form(
        default=None, description="Optional custom output file name (without extension)."
    ),
    conversion_service: ParquetConversionService = Depends(get_parquet_conversion_service_singleton),
    reader_service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> FileResponse:
    metadata = reader_service.get_metadata(file_id)
    output_name = conversion_service.resolve_csv_output_name(metadata.file_name, output_file_name)
    output_path = create_temp_file(suffix=".csv")

    try:
        row_count, column_count = reader_service.export_to_csv(
            file_id,
            output_path,
            delimiter=CSV_DELIMITER_CHARS[delimiter],
            include_header=include_header,
            quoting_style=CSV_QUOTING_STYLES[quoting],
        )
    except Exception:
        delete_quietly(output_path)
        raise

    result = ParquetToCsvResult(
        file_name=output_name,
        row_count=row_count,
        column_count=column_count,
        source_bytes=metadata.file_size_bytes,
        output_bytes=output_path.stat().st_size,
    )

    return FileResponse(
        path=output_path,
        media_type="text/csv",
        filename=output_name,
        headers=_csv_result_headers(result),
        background=BackgroundTask(cleanup_output, output_path),
    )


@router.post(
    "/reader/upload",
    summary="Upload a parquet file for reading",
    response_model=ParquetUploadResult,
)
def upload_for_reading(
    file: UploadFile = File(..., description="A .parquet file to inspect."),
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
    settings: Settings = Depends(get_settings),
) -> ParquetUploadResult:
    """Upload a parquet file once; returns a session id for follow-up requests.

    The file is kept on disk (not re-sent by the client) so metadata,
    schema, and row-page requests can all reuse the same session.
    """
    source_name = file.filename or "upload"
    source_path = _validate_and_spool(file, settings)

    file_id = service.register_upload(source_path, source_name)
    return ParquetUploadResult(
        file_id=file_id,
        metadata=service.get_metadata(file_id),
        columns=service.get_schema(file_id),
    )


@router.get(
    "/reader/{file_id}/metadata",
    summary="Get summary metadata for an uploaded parquet file",
    response_model=ParquetFileMetadata,
)
def get_reader_metadata(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ParquetFileMetadata:
    return service.get_metadata(file_id)


@router.get(
    "/reader/{file_id}/schema",
    summary="Get column schema for an uploaded parquet file",
    response_model=list[ColumnSchema],
)
def get_reader_schema(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> list[ColumnSchema]:
    return service.get_schema(file_id)


@router.get(
    "/reader/{file_id}/rows",
    summary="Get a page of row data for an uploaded parquet file",
    response_model=ParquetRowPage,
)
def get_reader_rows(
    file_id: str,
    offset: int = Query(default=0, ge=0, description="Row offset to start reading from."),
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum rows to return."),
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ParquetRowPage:
    return service.get_rows(file_id, offset, limit)


# ---- Parquet Analyzer ----
# A single-upload inspection workspace (Overview/Schema/Statistics/Profiling/
# Sampling/Storage tabs). Reuses ParquetReaderService's upload validation and
# session store unchanged - Analyzer and Reader are separate modules in the
# UI, but there is no reason to duplicate "validate + hold a parquet file
# session" twice.


@router.post(
    "/analyzer/upload",
    summary="Upload a parquet file for analysis",
    response_model=ParquetUploadResult,
)
def upload_for_analysis(
    file: UploadFile = File(..., description="A .parquet file to analyze."),
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
    settings: Settings = Depends(get_settings),
) -> ParquetUploadResult:
    source_name = file.filename or "upload"
    source_path = _validate_and_spool(file, settings)

    file_id = service.register_upload(source_path, source_name)
    return ParquetUploadResult(
        file_id=file_id,
        metadata=service.get_metadata(file_id),
        columns=service.get_schema(file_id),
    )


@router.get(
    "/analyzer/{file_id}/overview",
    summary="Get overview metadata for an analyzed parquet file",
    response_model=ParquetFileMetadata,
)
def get_analyzer_overview(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ParquetFileMetadata:
    return service.get_metadata(file_id)


@router.get(
    "/analyzer/{file_id}/schema",
    summary="Get column schema for an analyzed parquet file",
    response_model=list[ColumnSchema],
)
def get_analyzer_schema(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> list[ColumnSchema]:
    return service.get_schema(file_id)


@router.get(
    "/analyzer/{file_id}/statistics",
    summary="Get per-column statistics for an analyzed parquet file",
    response_model=ParquetStatistics,
)
def get_analyzer_statistics(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ParquetStatistics:
    return service.get_statistics(file_id)


@router.get(
    "/analyzer/{file_id}/columns/{column_name}/profile",
    summary="Get a detailed profile for one column of an analyzed parquet file",
    response_model=ColumnProfile,
)
def get_analyzer_column_profile(
    file_id: str,
    column_name: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ColumnProfile:
    return service.get_column_profile(file_id, column_name)


@router.get(
    "/analyzer/{file_id}/sample",
    summary="Get a row sample (first N or random) from an analyzed parquet file",
    response_model=ParquetSample,
)
def get_analyzer_sample(
    file_id: str,
    mode: SampleMode = Query(default=SampleMode.FIRST, description="'first' or 'random'."),
    size: int = Query(default=100, ge=1, le=5000, description="Number of rows to sample."),
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> ParquetSample:
    return service.get_sample(file_id, mode, size)


@router.get(
    "/analyzer/{file_id}/storage",
    summary="Get storage/compression analysis for an analyzed parquet file",
    response_model=StorageAnalysis,
)
def get_analyzer_storage(
    file_id: str,
    service: ParquetReaderService = Depends(get_parquet_reader_service_singleton),
) -> StorageAnalysis:
    return service.get_storage_analysis(file_id)


# ---- Schema Comparison ----
# Stateless: both files are uploaded together, diffed once, and their temp
# copies are deleted immediately after - there is no follow-up session like
# Reader/Analyzer have, since a comparison result is a single point-in-time
# snapshot rather than something explored interactively over many requests.


@router.post(
    "/comparison/compare",
    summary="Compare the schemas of two parquet files",
    response_model=SchemaComparisonResult,
)
def compare_schemas(
    file_a: UploadFile = File(..., description="The baseline/original .parquet file."),
    file_b: UploadFile = File(..., description="The new/changed .parquet file to compare against File A."),
    include_order_changes: bool = Form(
        default=False, description="Also flag column position/order changes as differences."
    ),
    service: ParquetSchemaComparisonService = Depends(get_parquet_schema_comparison_service_singleton),
    settings: Settings = Depends(get_settings),
) -> SchemaComparisonResult:
    path_a = _validate_and_spool(file_a, settings)
    try:
        path_b = _validate_and_spool(file_b, settings)
    except Exception:
        delete_quietly(path_a)
        raise

    try:
        return service.compare(
            path_a,
            file_a.filename or "file_a.parquet",
            path_b,
            file_b.filename or "file_b.parquet",
            include_order_changes=include_order_changes,
        )
    finally:
        delete_quietly(path_a)
        delete_quietly(path_b)


def _validate_and_spool(file: UploadFile, settings: Settings) -> Path:
    source_name = file.filename or "upload"
    if get_extension(source_name) != "parquet":
        raise UnsupportedFileTypeError(source_name, ["parquet"])

    path, source_bytes = spool_to_temp_file(file.file, suffix=".parquet")
    if source_bytes == 0:
        delete_quietly(path)
        raise EmptyFileError(source_name)
    if source_bytes > settings.max_upload_bytes:
        delete_quietly(path)
        raise FileTooLargeError(source_name, settings.max_upload_bytes)
    return path


@router.post(
    "/comparison/export",
    summary="Export a schema comparison result as a Markdown or CSV report",
)
def export_comparison(
    export_format: ComparisonExportFormat = Query(..., alias="format"),
    result: SchemaComparisonResult = Body(...),
) -> Response:
    content, media_type = render_export(result, export_format)
    extension = "md" if export_format == ComparisonExportFormat.MARKDOWN else "csv"
    file_name = f"schema-comparison.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
