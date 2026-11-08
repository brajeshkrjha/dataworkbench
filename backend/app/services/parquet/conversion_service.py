"""CSV/TSV/JSON/Excel/XML/Avro/ORC -> Parquet conversion.

Per-format parsing logic lives in `converters.py` as a strategy
registry keyed by `SourceFormat`; this service only resolves the
format, validates size, and dispatches to the right converter. Output
is written to a temporary parquet file which the router streams back
to the client.
"""
from datetime import datetime
from pathlib import Path

import pyarrow.parquet as pq

from app.core.exceptions import EmptyFileError, UnsupportedFileTypeError
from app.schemas.parquet import (
    DEFAULT_COMPRESSION,
    CompressionCodec,
    ConversionResult,
    MappedDataType,
    SchemaInspectionResult,
    SourceFormat,
)
from app.services.parquet.converters import CONVERTERS
from app.services.schema_mapping.inspector import inspect_delimited_text
from app.services.schema_mapping.types import from_arrow_type
from app.utils.file_utils import delete_quietly, get_extension, sanitize_file_name

_DELIMITED_DELIMITERS: dict[SourceFormat, str] = {
    SourceFormat.CSV: ",",
    SourceFormat.TSV: "\t",
}

_EXTENSION_TO_FORMAT: dict[str, SourceFormat] = {
    "csv": SourceFormat.CSV,
    "tsv": SourceFormat.TSV,
    "json": SourceFormat.JSON,
    "ndjson": SourceFormat.JSON,
    "jsonl": SourceFormat.JSON,
    "xlsx": SourceFormat.EXCEL,
    "xls": SourceFormat.EXCEL,
    "xml": SourceFormat.XML,
    "avro": SourceFormat.AVRO,
    "orc": SourceFormat.ORC,
}

SUPPORTED_EXTENSIONS: list[str] = sorted(_EXTENSION_TO_FORMAT)

_TIMESTAMP_FORMAT = "%Y%m%d_%H%M%S"


def _build_output_name(source_name: str, requested_name: str | None, extension: str) -> str:
    """Shared output-name resolution for both parquet and CSV exports.

    A user-provided name is preserved exactly as given. Otherwise the
    source file name is reused with a timestamp appended, so repeated
    downloads of the same source file don't collide.
    """
    if requested_name and requested_name.strip():
        stem = Path(sanitize_file_name(requested_name.strip(), "converted")).stem
        return f"{stem or 'converted'}.{extension}"

    stem = Path(sanitize_file_name(source_name, "converted")).stem or "converted"
    timestamp = datetime.now().astimezone().strftime(_TIMESTAMP_FORMAT)
    return f"{stem}_{timestamp}.{extension}"


class ParquetConversionService:
    """Converts supported tabular files into parquet."""

    def detect_format(self, file_name: str) -> SourceFormat:
        """Resolve a source format from a file name, or raise."""
        source_format = _EXTENSION_TO_FORMAT.get(get_extension(file_name))
        if source_format is None:
            raise UnsupportedFileTypeError(file_name, SUPPORTED_EXTENSIONS)
        return source_format

    def resolve_output_name(self, source_name: str, requested_name: str | None) -> str:
        """Build a safe `.parquet` output file name.

        A user-provided name is preserved exactly as given. Otherwise the
        source file name is reused with a timestamp appended, so repeated
        downloads of the same source file don't collide.
        """
        return _build_output_name(source_name, requested_name, "parquet")

    def resolve_csv_output_name(self, source_name: str, requested_name: str | None) -> str:
        """Build a safe `.csv` output file name (Parquet -> CSV export).

        Same naming rules as `resolve_output_name`: a user-provided name is
        used exactly as given, otherwise the source name gets a timestamp
        appended so repeated exports of the same source file don't collide.
        """
        return _build_output_name(source_name, requested_name, "csv")

    def convert(
        self,
        source_path: Path,
        source_name: str,
        source_bytes: int,
        output_path: Path,
        output_name: str,
        compression: CompressionCodec = DEFAULT_COMPRESSION,
        column_overrides: dict[str, MappedDataType] | None = None,
    ) -> ConversionResult:
        """Convert a source file on disk into a parquet file on disk.

        `column_overrides` (column name -> `MappedDataType`) lets callers
        override auto-detected datatypes; currently applied for CSV/TSV,
        ignored (no-op) by formats that don't yet support it.
        """
        if source_bytes == 0:
            raise EmptyFileError(source_name)

        source_format = self.detect_format(source_name)
        codec = None if compression is CompressionCodec.NONE else compression.value

        converter = CONVERTERS[source_format]
        row_count, column_count = converter.convert(
            source_path, source_name, output_path, codec, column_overrides
        )

        return ConversionResult(
            file_name=output_name,
            source_format=source_format,
            compression=compression,
            row_count=row_count,
            column_count=column_count,
            source_bytes=source_bytes,
            output_bytes=output_path.stat().st_size,
            schema_summary=self._summarize_output_schema(output_path),
        )

    def inspect_schema(self, source_path: Path, source_name: str) -> SchemaInspectionResult:
        """Sample a source file and report detected per-column datatypes.

        Currently supports CSV/TSV (the delimited-text formats); other
        formats raise `UnsupportedFileTypeError` until they gain their own
        Arrow-table-producing inspection path.
        """
        source_format = self.detect_format(source_name)
        delimiter = _DELIMITED_DELIMITERS.get(source_format)
        if delimiter is None:
            raise UnsupportedFileTypeError(source_name, sorted(f.value for f in _DELIMITED_DELIMITERS))
        return inspect_delimited_text(source_path, source_name, delimiter)

    @staticmethod
    def _summarize_output_schema(output_path: Path) -> dict[str, int]:
        summary: dict[str, int] = {}
        for field in pq.read_schema(output_path):
            key = from_arrow_type(field.type).value
            summary[key] = summary.get(key, 0) + 1
        return summary


def cleanup_output(path: Path) -> None:
    """Delete a generated parquet file once it has been streamed."""
    delete_quietly(path)
