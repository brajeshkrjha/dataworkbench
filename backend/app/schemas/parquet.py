"""Schemas for the Parquet Utility tool.

Covers the file-conversion and reader modules. Future Parquet Utility
modules (metadata explorer, profiling, ...) add their own schemas to
this module.
"""
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class SourceFormat(str, Enum):
    """Input formats supported by the parquet converter."""

    CSV = "csv"
    TSV = "tsv"
    JSON = "json"
    EXCEL = "excel"
    XML = "xml"
    AVRO = "avro"
    ORC = "orc"


class CompressionCodec(str, Enum):
    """Parquet compression codecs exposed to users."""

    SNAPPY = "snappy"
    GZIP = "gzip"
    BROTLI = "brotli"
    NONE = "none"


DEFAULT_COMPRESSION = CompressionCodec.SNAPPY
"""Snappy: fast, splittable, and the de-facto default for data lakes."""


class CsvDelimiter(str, Enum):
    """Delimiter choices exposed to users for Parquet -> CSV export."""

    COMMA = "comma"
    PIPE = "pipe"
    TAB = "tab"
    SEMICOLON = "semicolon"


CSV_DELIMITER_CHARS: dict[CsvDelimiter, str] = {
    CsvDelimiter.COMMA: ",",
    CsvDelimiter.PIPE: "|",
    CsvDelimiter.TAB: "\t",
    CsvDelimiter.SEMICOLON: ";",
}

DEFAULT_CSV_DELIMITER = CsvDelimiter.COMMA


class CsvQuoting(str, Enum):
    """Quoting style choices exposed to users for Parquet -> CSV export."""

    STANDARD = "standard"
    MINIMAL = "minimal"


CSV_QUOTING_STYLES: dict[CsvQuoting, str] = {
    # "needed": quote only fields that require it (delimiter/quote/newline) -
    # the conventional, safe default for downstream CSV consumers.
    CsvQuoting.STANDARD: "needed",
    # "none": never quote. Smaller/faster output; only safe when the data is
    # known not to contain the chosen delimiter, quotes, or newlines.
    CsvQuoting.MINIMAL: "none",
}

DEFAULT_CSV_QUOTING = CsvQuoting.STANDARD


class ParquetToCsvResult(BaseModel):
    """Metadata describing a completed Parquet -> CSV export."""

    file_name: str = Field(..., description="Name of the generated CSV file.")
    row_count: int = Field(..., description="Number of rows written to the CSV file.")
    column_count: int = Field(..., description="Number of columns written.")
    source_bytes: int = Field(..., description="Size of the source parquet file in bytes.")
    output_bytes: int = Field(..., description="Size of the generated CSV file in bytes.")


class ConversionResult(BaseModel):
    """Metadata describing a completed conversion.

    Returned alongside the parquet download as response headers, and
    used as the documented response schema for the convert endpoint.
    """

    file_name: str = Field(..., description="Name of the generated parquet file.")
    source_format: SourceFormat = Field(..., description="Detected input format.")
    compression: CompressionCodec = Field(..., description="Compression codec applied.")
    row_count: int = Field(..., description="Number of rows written to the parquet file.")
    column_count: int = Field(..., description="Number of columns written.")
    source_bytes: int = Field(..., description="Size of the uploaded source file in bytes.")
    output_bytes: int = Field(..., description="Size of the generated parquet file in bytes.")
    schema_summary: dict[str, int] = Field(
        default_factory=dict,
        description="Count of output columns per datatype family, e.g. {'string': 24, 'integer': 5}.",
    )


# ---- Schema & Datatype Mapping (Convert Files) ----
# A small, format-agnostic engine: inspect a sample of the uploaded file,
# report detected datatypes per column, and let users override them before
# conversion. Built to extend beyond CSV/TSV to any future source format
# that can be read into an Arrow table (Excel, XML, ...).


class MappedDataType(str, Enum):
    """The practical datatype set exposed to users for schema overrides."""

    STRING = "string"
    INTEGER = "integer"
    LONG = "long"
    DOUBLE = "double"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATE = "date"
    TIMESTAMP = "timestamp"


class SchemaFieldInfo(BaseModel):
    """A single column's detected schema, from a sampled read of the source file."""

    name: str = Field(..., description="Column name.")
    detected_type: MappedDataType = Field(..., description="Auto-detected datatype.")
    sample_values: list[str] = Field(
        default_factory=list, description="A few example non-null values from the sample."
    )
    null_percentage: float = Field(
        ..., description="Percentage of null values within the sampled rows."
    )


class SchemaInspectionResult(BaseModel):
    """Response for the pre-conversion schema inspection step."""

    file_name: str = Field(..., description="Uploaded file name.")
    row_sample_count: int = Field(..., description="Number of rows sampled to detect types.")
    fields: list[SchemaFieldInfo]
    preview_rows: list[dict[str, Any]] = Field(
        default_factory=list, description="First few rows of the sample, for a lightweight preview."
    )


class ColumnTypeOverride(BaseModel):
    """A single user-requested datatype override for one column."""

    column: str = Field(..., description="Column name to override.")
    data_type: MappedDataType = Field(..., description="Datatype to cast the column to.")


class ColumnSchema(BaseModel):
    """A single column's schema, as declared in the parquet file footer."""

    name: str = Field(..., description="Column name.")
    data_type: str = Field(..., description="Arrow/parquet data type, e.g. 'int64', 'string'.")
    nullable: bool = Field(..., description="Whether the column allows null values.")


class ParquetFileMetadata(BaseModel):
    """Summary metadata read from a parquet file's footer (no row data)."""

    file_name: str = Field(..., description="Original uploaded file name.")
    file_size_bytes: int = Field(..., description="Size of the uploaded file in bytes.")
    row_count: int = Field(..., description="Total number of rows in the file.")
    column_count: int = Field(..., description="Total number of columns in the file.")
    row_group_count: int = Field(..., description="Number of row groups in the file.")
    compression: str | None = Field(
        default=None, description="Compression codec used, if detectable."
    )
    created_by: str | None = Field(
        default=None, description="Writer library/version recorded in the file footer, if any."
    )


class ParquetUploadResult(BaseModel):
    """Response returned after uploading a parquet file for reading."""

    file_id: str = Field(..., description="Opaque session id for follow-up requests.")
    metadata: ParquetFileMetadata
    columns: list[ColumnSchema]


class ParquetRowPage(BaseModel):
    """A single page of row data read from a parquet file."""

    rows: list[dict[str, Any]]
    total_row_count: int = Field(..., description="Total rows in the file (for pagination).")
    offset: int
    limit: int


# ---- Parquet Analyzer ----
# A single-file inspection workspace: Overview, Schema, Statistics, Column
# Profiling, Sampling, and Storage Analysis tabs all read from the same
# uploaded-file session (see ParquetReaderService, which the analyzer
# endpoints reuse) rather than each being a separate upload/module.


class ColumnStatistics(BaseModel):
    """Per-column statistics for the Statistics tab.

    `null_count`/`min_value`/`max_value` come straight from the parquet
    footer (no data read). `distinct_count`/`avg_value` require reading the
    column's data and are omitted (`None`) once the file is too large to
    scan cheaply - see `_MAX_ROWS_FOR_FULL_STATS` in reader_service.py.
    """

    name: str
    data_type: str
    null_count: int
    null_percentage: float
    distinct_count: int | None = None
    min_value: str | None = None
    max_value: str | None = None
    avg_value: float | None = None


class ParquetStatistics(BaseModel):
    row_count: int
    column_count: int
    columns: list[ColumnStatistics]


class CommonValue(BaseModel):
    value: str | None
    count: int


class ColumnProfile(BaseModel):
    """Detailed profile for a single selected column (Column Profiling tab)."""

    name: str
    data_type: str
    null_count: int
    null_percentage: float
    distinct_count: int
    cardinality_ratio: float = Field(..., description="distinct_count / non-null row count, 0-1.")
    most_common_values: list[CommonValue]
    min_value: str | None = None
    max_value: str | None = None
    avg_value: float | None = None


class SampleMode(str, Enum):
    FIRST = "first"
    RANDOM = "random"


class ParquetSample(BaseModel):
    """Row sample for the Sampling tab - never materializes the full dataset."""

    mode: SampleMode
    sample_size: int
    rows: list[dict[str, Any]]


class RowGroupStorage(BaseModel):
    index: int
    row_count: int
    compressed_size_bytes: int
    uncompressed_size_bytes: int


class ColumnStorage(BaseModel):
    name: str
    compressed_size_bytes: int
    uncompressed_size_bytes: int
    compression_ratio: float = Field(..., description="uncompressed / compressed, 1.0 = no savings.")


class StorageAnalysis(BaseModel):
    """Storage Analysis tab - all derived from footer metadata, no data read."""

    compression: str | None
    total_compressed_bytes: int
    total_uncompressed_bytes: int
    overall_compression_ratio: float
    row_groups: list[RowGroupStorage]
    columns: list[ColumnStorage]


# ---- Schema Comparison ----
# Compares two parquet files' schemas (never their row data) to surface
# structural drift and breaking-change risk between two versions of a
# dataset - e.g. "does yesterday's file still match today's contract?".


class SchemaDiffType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    RENAMED = "renamed"
    TYPE_CHANGED = "type_changed"
    NULLABILITY_CHANGED = "nullability_changed"
    METADATA_CHANGED = "metadata_changed"
    REORDERED = "reordered"
    IDENTICAL = "identical"


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class SchemaHealth(str, Enum):
    MATCHING = "matching"
    MINOR_DIFFERENCES = "minor_differences"
    BREAKING_CHANGES = "breaking_changes"


class ColumnDiff(BaseModel):
    """A single column's comparison result between File A and File B."""

    column_name: str = Field(..., description="Display name - name_b for renames, else the shared name.")
    name_a: str | None = None
    name_b: str | None = None
    diff_type: SchemaDiffType
    risk_level: RiskLevel
    data_type_a: str | None = None
    data_type_b: str | None = None
    nullable_a: bool | None = None
    nullable_b: bool | None = None
    metadata_a: dict[str, str] | None = None
    metadata_b: dict[str, str] | None = None
    encoding_a: str | None = None
    encoding_b: str | None = None
    position_a: int | None = None
    position_b: int | None = None
    rename_confidence: float | None = Field(
        default=None, description="0-1 similarity score for best-effort rename matches."
    )
    details: list[str] = Field(default_factory=list, description="Human-readable change descriptions.")


class ComparisonSummary(BaseModel):
    columns_added: int
    columns_removed: int
    columns_modified: int
    type_changes: int
    nullability_changes: int
    metadata_changes: int
    renamed_columns: int
    identical_columns: int
    total_differences: int
    health: SchemaHealth


class SchemaDriftAnalysis(BaseModel):
    drift_score: float = Field(..., description="0-100: how much the schema has drifted (100 = totally different).")
    match_percentage: float = Field(..., description="0-100: how much of the schema is unchanged.")
    explanation: str


class SchemaComparisonResult(BaseModel):
    file_a: ParquetFileMetadata
    file_b: ParquetFileMetadata
    summary: ComparisonSummary
    drift: SchemaDriftAnalysis
    columns: list[ColumnDiff]


class ComparisonExportFormat(str, Enum):
    MARKDOWN = "markdown"
    CSV = "csv"


