"""CSV comparator: row-aligned diff via `difflib`, treating each row's
common-column values as a composite key (mirrors the text line-diff
alignment strategy, but at row granularity)."""
import csv
import difflib
import io

from app.schemas.text_compare import CsvComparisonDetail, CsvRowDiff, DiffType
from app.services.text_compare.comparators.base import BaseComparator, ComparatorOutput

_MAX_ROWS = 5000


def _parse_csv(text: str) -> tuple[list[str], list[dict[str, str]]]:
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    columns = list(reader.fieldnames or [])
    return columns, rows


def _row_key(row: dict[str, str], columns: list[str]) -> str:
    return "\x1f".join(row.get(column, "") for column in columns)


class CsvComparator(BaseComparator):
    def compare(self, text_a: str, text_b: str) -> ComparatorOutput:
        columns_a, rows_a = _parse_csv(text_a)
        columns_b, rows_b = _parse_csv(text_b)

        columns_added = [c for c in columns_b if c not in columns_a]
        columns_removed = [c for c in columns_a if c not in columns_b]
        common_columns = [c for c in columns_a if c in columns_b]

        keys_a = [_row_key(row, common_columns) for row in rows_a]
        keys_b = [_row_key(row, common_columns) for row in rows_b]
        matcher = difflib.SequenceMatcher(None, keys_a, keys_b)

        row_diffs: list[CsvRowDiff] = []
        added = removed = modified = identical = 0

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                for offset in range(i2 - i1):
                    row_diffs.append(
                        CsvRowDiff(
                            row_index=i1 + offset,
                            diff_type=DiffType.IDENTICAL,
                            row_a=rows_a[i1 + offset],
                            row_b=rows_b[j1 + offset],
                        )
                    )
                    identical += 1
            elif tag == "replace":
                common = min(i2 - i1, j2 - j1)
                for offset in range(common):
                    row_a = rows_a[i1 + offset]
                    row_b = rows_b[j1 + offset]
                    changed_columns = [c for c in common_columns if row_a.get(c) != row_b.get(c)]
                    row_diffs.append(
                        CsvRowDiff(
                            row_index=i1 + offset,
                            diff_type=DiffType.MODIFIED,
                            row_a=row_a,
                            row_b=row_b,
                            changed_columns=changed_columns,
                        )
                    )
                    modified += 1
                for offset in range(common, i2 - i1):
                    row_diffs.append(
                        CsvRowDiff(row_index=i1 + offset, diff_type=DiffType.REMOVED, row_a=rows_a[i1 + offset])
                    )
                    removed += 1
                for offset in range(common, j2 - j1):
                    row_diffs.append(
                        CsvRowDiff(row_index=j1 + offset, diff_type=DiffType.ADDED, row_b=rows_b[j1 + offset])
                    )
                    added += 1
            elif tag == "delete":
                for offset in range(i2 - i1):
                    row_diffs.append(
                        CsvRowDiff(row_index=i1 + offset, diff_type=DiffType.REMOVED, row_a=rows_a[i1 + offset])
                    )
                    removed += 1
            elif tag == "insert":
                for offset in range(j2 - j1):
                    row_diffs.append(
                        CsvRowDiff(row_index=j1 + offset, diff_type=DiffType.ADDED, row_b=rows_b[j1 + offset])
                    )
                    added += 1

        total = added + removed + modified + identical or 1
        similarity = round((identical / total) * 100, 1)

        detail = CsvComparisonDetail(
            row_count_a=len(rows_a),
            row_count_b=len(rows_b),
            column_count_a=len(columns_a),
            column_count_b=len(columns_b),
            columns_added=columns_added,
            columns_removed=columns_removed,
            rows_added=added,
            rows_removed=removed,
            rows_modified=modified,
            rows_identical=identical,
            rows=row_diffs[:_MAX_ROWS],
        )

        return ComparatorOutput(
            added=added,
            removed=removed,
            modified=modified,
            identical=identical,
            similarity_score=similarity,
            csv_detail=detail,
        )
