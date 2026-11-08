"""Orchestrates type resolution, comparator dispatch, and summary/risk
scoring for a single stateless two-sided comparison."""
from app.schemas.text_compare import (
    ComparisonInputType,
    ComparisonResult,
    ComparisonSummary,
    TextComparisonDetail,
)
from app.services.text_compare.comparators.base import BaseComparator
from app.services.text_compare.comparators.csv_comparator import CsvComparator
from app.services.text_compare.comparators.sql_comparator import SqlComparator
from app.services.text_compare.comparators.structured_comparator import StructuredComparator
from app.services.text_compare.comparators.text_comparator import TextComparator
from app.services.text_compare.detection import detect_type
from app.services.text_compare.diff_utils import line_diff, risk_from_counts

_STRUCTURED_TYPES = {ComparisonInputType.JSON, ComparisonInputType.YAML, ComparisonInputType.XML}


class TextCompareService:
    """Stateless comparison engine. A baseline line-level text diff is
    always computed for the side-by-side view; a specialized comparator
    is additionally dispatched based on the resolved type to drive the
    summary metrics and any type-specific intelligence panel."""

    def compare(
        self,
        text_a: str,
        text_b: str,
        file_name_a: str | None,
        file_name_b: str | None,
        type_override: ComparisonInputType | None = None,
    ) -> ComparisonResult:
        detected_a = detect_type(text_a, file_name_a)
        detected_b = detect_type(text_b, file_name_b)
        resolved_type = type_override or detected_a

        text_lines, _ = line_diff(text_a, text_b)
        text_detail = TextComparisonDetail(lines=text_lines)

        comparator = self._resolve_comparator(resolved_type)
        output = comparator.compare(text_a, text_b)

        total = output.added + output.removed + output.modified + output.identical
        summary = ComparisonSummary(
            similarity_score=output.similarity_score,
            added_count=output.added,
            removed_count=output.removed,
            modified_count=output.modified,
            identical_count=output.identical,
            total_differences=output.added + output.removed + output.modified,
            risk_level=risk_from_counts(output.added, output.removed, output.modified, total),
        )

        return ComparisonResult(
            input_type=resolved_type,
            detected_type_a=detected_a,
            detected_type_b=detected_b,
            file_name_a=file_name_a or "Version A",
            file_name_b=file_name_b or "Version B",
            summary=summary,
            text_detail=text_detail,
            structured_detail=output.structured_detail,
            csv_detail=output.csv_detail,
            sql_detail=output.sql_detail,
        )

    @staticmethod
    def _resolve_comparator(resolved_type: ComparisonInputType) -> BaseComparator:
        if resolved_type in _STRUCTURED_TYPES:
            return StructuredComparator(resolved_type)
        if resolved_type == ComparisonInputType.CSV:
            return CsvComparator()
        if resolved_type == ComparisonInputType.SQL:
            return SqlComparator()
        return TextComparator()
