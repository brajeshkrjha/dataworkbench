"""Renders a `ComparisonResult` as a Markdown or CSV report, mirroring
`app/services/parquet/comparison_export.py`."""
import csv
import io

from app.schemas.text_compare import ComparisonExportFormat, ComparisonResult


def render_export(result: ComparisonResult, export_format: ComparisonExportFormat) -> tuple[str, str]:
    if export_format == ComparisonExportFormat.CSV:
        return _render_csv(result), "text/csv"
    return _render_markdown(result), "text/markdown"


def _render_markdown(result: ComparisonResult) -> str:
    summary = result.summary
    lines: list[str] = [
        "# Text Compare Report",
        "",
        f"**Version A:** {result.file_name_a} (detected: {result.detected_type_a.value})",
        f"**Version B:** {result.file_name_b} (detected: {result.detected_type_b.value})",
        f"**Comparison type:** {result.input_type.value}",
        "",
        f"## Similarity: {summary.similarity_score}% Match",
        "",
        f"**Risk level:** {summary.risk_level.value.upper()}",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "| --- | --- |",
        f"| Added | {summary.added_count} |",
        f"| Removed | {summary.removed_count} |",
        f"| Modified | {summary.modified_count} |",
        f"| Identical | {summary.identical_count} |",
        f"| Total Differences | {summary.total_differences} |",
        "",
    ]

    if result.csv_detail:
        detail = result.csv_detail
        lines += [
            "## CSV Intelligence",
            "",
            f"- Rows A: {detail.row_count_a}, Rows B: {detail.row_count_b}",
            f"- Columns added: {', '.join(detail.columns_added) or 'none'}",
            f"- Columns removed: {', '.join(detail.columns_removed) or 'none'}",
            f"- Rows added/removed/modified: {detail.rows_added}/{detail.rows_removed}/{detail.rows_modified}",
            "",
        ]

    if result.structured_detail:
        detail = result.structured_detail
        lines += [
            "## Structured Intelligence",
            "",
            f"- Keys added: {detail.keys_added}",
            f"- Keys removed: {detail.keys_removed}",
            f"- Values changed: {detail.values_changed}",
            "",
        ]

    if result.sql_detail:
        detail = result.sql_detail
        lines += [
            "## SQL Intelligence",
            "",
            f"- Tables added: {', '.join(detail.tables_added) or 'none'}",
            f"- Tables removed: {', '.join(detail.tables_removed) or 'none'}",
            f"- Joins added: {', '.join(detail.joins_added) or 'none'}",
            f"- Joins removed: {', '.join(detail.joins_removed) or 'none'}",
            f"- Filters added: {', '.join(detail.filters_added) or 'none'}",
            f"- Filters removed: {', '.join(detail.filters_removed) or 'none'}",
            "",
        ]

    lines += [
        "## Line Differences",
        "",
        "| Line A | Line B | Change | Content A | Content B |",
        "| --- | --- | --- | --- | --- |",
    ]
    for line in result.text_detail.lines:
        if line.diff_type.value == "identical":
            continue
        content_a = (line.content_a or "").replace("|", "/")[:120]
        content_b = (line.content_b or "").replace("|", "/")[:120]
        lines.append(
            f"| {line.line_number_a or ''} | {line.line_number_b or ''} | {line.diff_type.value} | {content_a} | {content_b} |"
        )

    return "\n".join(lines)


def _render_csv(result: ComparisonResult) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["line_a", "line_b", "diff_type", "content_a", "content_b"])
    for line in result.text_detail.lines:
        writer.writerow(
            [
                line.line_number_a or "",
                line.line_number_b or "",
                line.diff_type.value,
                line.content_a or "",
                line.content_b or "",
            ]
        )
    return buffer.getvalue()
