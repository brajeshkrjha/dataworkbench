"""Shared line-diff and risk-scoring helpers used across comparators."""
import difflib

from app.schemas.text_compare import DiffType, LineDiff, RiskLevel


def similarity_ratio(text_a: str, text_b: str) -> float:
    if not text_a and not text_b:
        return 100.0
    return round(difflib.SequenceMatcher(None, text_a, text_b).ratio() * 100, 1)


def _line_key(line: str, ignore_case: bool, ignore_whitespace: bool) -> str:
    if ignore_whitespace:
        line = " ".join(line.split())
    if ignore_case:
        line = line.lower()
    return line


def line_diff(
    text_a: str,
    text_b: str,
    ignore_case: bool = False,
    ignore_whitespace: bool = False,
) -> tuple[list[LineDiff], dict[str, int]]:
    """Line-level diff via `difflib`, always computed as the baseline
    side-by-side view regardless of the resolved comparison type. The
    ignore flags only affect matching; original content is displayed."""
    lines_a = text_a.splitlines()
    lines_b = text_b.splitlines()
    keys_a = [_line_key(line, ignore_case, ignore_whitespace) for line in lines_a]
    keys_b = [_line_key(line, ignore_case, ignore_whitespace) for line in lines_b]
    matcher = difflib.SequenceMatcher(None, keys_a, keys_b)

    result: list[LineDiff] = []
    counts = {"added": 0, "removed": 0, "modified": 0, "identical": 0}

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                result.append(
                    LineDiff(
                        line_number_a=i1 + offset + 1,
                        line_number_b=j1 + offset + 1,
                        diff_type=DiffType.IDENTICAL,
                        content_a=lines_a[i1 + offset],
                        content_b=lines_b[j1 + offset],
                    )
                )
                counts["identical"] += 1
        elif tag == "replace":
            common = min(i2 - i1, j2 - j1)
            for offset in range(common):
                result.append(
                    LineDiff(
                        line_number_a=i1 + offset + 1,
                        line_number_b=j1 + offset + 1,
                        diff_type=DiffType.MODIFIED,
                        content_a=lines_a[i1 + offset],
                        content_b=lines_b[j1 + offset],
                    )
                )
                counts["modified"] += 1
            for offset in range(common, i2 - i1):
                result.append(
                    LineDiff(
                        line_number_a=i1 + offset + 1,
                        diff_type=DiffType.REMOVED,
                        content_a=lines_a[i1 + offset],
                    )
                )
                counts["removed"] += 1
            for offset in range(common, j2 - j1):
                result.append(
                    LineDiff(
                        line_number_b=j1 + offset + 1,
                        diff_type=DiffType.ADDED,
                        content_b=lines_b[j1 + offset],
                    )
                )
                counts["added"] += 1
        elif tag == "delete":
            for offset in range(i2 - i1):
                result.append(
                    LineDiff(
                        line_number_a=i1 + offset + 1,
                        diff_type=DiffType.REMOVED,
                        content_a=lines_a[i1 + offset],
                    )
                )
                counts["removed"] += 1
        elif tag == "insert":
            for offset in range(j2 - j1):
                result.append(
                    LineDiff(
                        line_number_b=j1 + offset + 1,
                        diff_type=DiffType.ADDED,
                        content_b=lines_b[j1 + offset],
                    )
                )
                counts["added"] += 1

    return result, counts


def risk_from_counts(added: int, removed: int, modified: int, total: int) -> RiskLevel:
    """Mirrors the heuristic used by `ParquetSchemaComparisonService`:
    removals are the riskiest signal, modifications are moderate, and
    pure additions are low risk."""
    if total == 0:
        return RiskLevel.NONE
    changed_ratio = (removed + modified) / total
    if removed > 0 and changed_ratio > 0.2:
        return RiskLevel.HIGH
    if removed > 0 or modified > 0:
        return RiskLevel.MEDIUM
    if added > 0:
        return RiskLevel.LOW
    return RiskLevel.NONE
