"""Renders a `SchemaComparisonResult` as a downloadable Markdown or CSV
report (summary + risk assessment + full per-column diff)."""
import csv
import io

from app.schemas.parquet import ComparisonExportFormat, SchemaComparisonResult

_HEALTH_LABELS = {
    "matching": "Matching",
    "minor_differences": "Minor Differences",
    "breaking_changes": "Breaking Changes",
}

_HEALTH_ICONS = {
    "matching": "\u2705",
    "minor_differences": "\u26a0\ufe0f",
    "breaking_changes": "\u274c",
}


def render_export(result: SchemaComparisonResult, export_format: ComparisonExportFormat) -> tuple[str, str]:
    """Returns (content, media_type)."""
    if export_format == ComparisonExportFormat.CSV:
        return _render_csv(result), "text/csv"
    return _render_markdown(result), "text/markdown"


def _render_markdown(result: SchemaComparisonResult) -> str:
    summary = result.summary
    drift = result.drift
    lines: list[str] = []

    lines.append("# Schema Comparison Report")
    lines.append("")
    lines.append(f"**File A:** {result.file_a.file_name} "
                 f"({result.file_a.row_count:,} rows, {result.file_a.column_count} columns)")
    lines.append(f"**File B:** {result.file_b.file_name} "
                 f"({result.file_b.row_count:,} rows, {result.file_b.column_count} columns)")
    lines.append("")

    icon = _HEALTH_ICONS.get(summary.health.value, "")
    label = _HEALTH_LABELS.get(summary.health.value, summary.health.value)
    lines.append(f"## Health: {icon} {label}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Metric | Count |")
    lines.append("| --- | --- |")
    lines.append(f"| Columns Added | {summary.columns_added} |")
    lines.append(f"| Columns Removed | {summary.columns_removed} |")
    lines.append(f"| Columns Modified | {summary.columns_modified} |")
    lines.append(f"| Type Changes | {summary.type_changes} |")
    lines.append(f"| Nullability Changes | {summary.nullability_changes} |")
    lines.append(f"| Metadata Changes | {summary.metadata_changes} |")
    lines.append(f"| Renamed Columns | {summary.renamed_columns} |")
    lines.append(f"| Identical Columns | {summary.identical_columns} |")
    lines.append(f"| Total Differences | {summary.total_differences} |")
    lines.append("")

    lines.append("## Schema Drift")
    lines.append("")
    lines.append(f"- **Drift score:** {drift.drift_score}%")
    lines.append(f"- **Match:** {drift.match_percentage}%")
    lines.append(f"- {drift.explanation}")
    lines.append("")

    lines.append("## Risk Assessment")
    lines.append("")
    high = [c for c in result.columns if c.risk_level.value == "high"]
    medium = [c for c in result.columns if c.risk_level.value == "medium"]
    low = [c for c in result.columns if c.risk_level.value == "low"]
    lines.append(f"- **High risk:** {len(high)} column(s) - removed columns and data type changes.")
    lines.append(f"- **Medium risk:** {len(medium)} column(s) - nullability and rename changes.")
    lines.append(f"- **Low risk:** {len(low)} column(s) - additions and metadata-only changes.")
    lines.append("")

    lines.append("## Column Differences")
    lines.append("")
    lines.append("| Column | Change | Risk | Type A | Type B | Details |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for col in result.columns:
        if col.diff_type.value == "identical":
            continue
        details = " ".join(col.details).replace("|", "/")
        lines.append(
            f"| {col.column_name} | {col.diff_type.value} | {col.risk_level.value} | "
            f"{col.data_type_a or ''} | {col.data_type_b or ''} | {details} |"
        )
    lines.append("")

    return "\n".join(lines)


def _render_csv(result: SchemaComparisonResult) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "column_name",
        "diff_type",
        "risk_level",
        "name_a",
        "name_b",
        "data_type_a",
        "data_type_b",
        "nullable_a",
        "nullable_b",
        "rename_confidence",
        "details",
    ])
    for col in result.columns:
        writer.writerow([
            col.column_name,
            col.diff_type.value,
            col.risk_level.value,
            col.name_a or "",
            col.name_b or "",
            col.data_type_a or "",
            col.data_type_b or "",
            col.nullable_a if col.nullable_a is not None else "",
            col.nullable_b if col.nullable_b is not None else "",
            col.rename_confidence if col.rename_confidence is not None else "",
            " | ".join(col.details),
        ])
    return buffer.getvalue()
