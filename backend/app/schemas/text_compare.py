"""Schemas for the Text Compare Utility."""
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ComparisonInputType(str, Enum):
    """The content type a comparison is resolved to, either detected
    automatically or forced via an explicit override."""

    TEXT = "text"
    CSV = "csv"
    JSON = "json"
    XML = "xml"
    YAML = "yaml"
    SQL = "sql"
    LOOKML = "lookml"
    DAX = "dax"


class DiffType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    IDENTICAL = "identical"


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class LineDiff(BaseModel):
    """A single aligned line pair in the side-by-side text view."""

    line_number_a: int | None = None
    line_number_b: int | None = None
    diff_type: DiffType
    content_a: str | None = None
    content_b: str | None = None


class TextComparisonDetail(BaseModel):
    """Baseline line-level diff, always populated regardless of the
    resolved comparison type, so the UI can always render side-by-side."""

    lines: list[LineDiff]


class StructuredDiffEntry(BaseModel):
    """A single key-path difference for JSON/YAML/XML comparisons."""

    path: str
    diff_type: DiffType
    value_a: str | None = None
    value_b: str | None = None


class StructuredComparisonDetail(BaseModel):
    keys_added: int
    keys_removed: int
    values_changed: int
    array_changes: int
    entries: list[StructuredDiffEntry]


class CsvRowDiff(BaseModel):
    row_index: int
    diff_type: DiffType
    row_a: dict[str, Any] | None = None
    row_b: dict[str, Any] | None = None
    changed_columns: list[str] = Field(default_factory=list)


class CsvComparisonDetail(BaseModel):
    row_count_a: int
    row_count_b: int
    column_count_a: int
    column_count_b: int
    columns_added: list[str]
    columns_removed: list[str]
    rows_added: int
    rows_removed: int
    rows_modified: int
    rows_identical: int
    rows: list[CsvRowDiff]


class SqlDiffEntry(BaseModel):
    category: str
    diff_type: DiffType
    detail: str


class SqlComparisonDetail(BaseModel):
    tables_added: list[str]
    tables_removed: list[str]
    joins_added: list[str]
    joins_removed: list[str]
    filters_added: list[str]
    filters_removed: list[str]
    columns_added: list[str]
    columns_removed: list[str]
    entries: list[SqlDiffEntry]


class ComparisonSummary(BaseModel):
    similarity_score: float
    added_count: int
    removed_count: int
    modified_count: int
    identical_count: int
    total_differences: int
    risk_level: RiskLevel


class ComparisonResult(BaseModel):
    """Full, stateless result of a single two-sided comparison."""

    input_type: ComparisonInputType
    detected_type_a: ComparisonInputType
    detected_type_b: ComparisonInputType
    file_name_a: str
    file_name_b: str
    summary: ComparisonSummary
    text_detail: TextComparisonDetail
    structured_detail: StructuredComparisonDetail | None = None
    csv_detail: CsvComparisonDetail | None = None
    sql_detail: SqlComparisonDetail | None = None


class ComparisonExportFormat(str, Enum):
    MARKDOWN = "markdown"
    CSV = "csv"
