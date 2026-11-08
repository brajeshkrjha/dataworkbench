"""SQL comparator: regex-based extraction of tables, joins, filters, and
selected columns (consistent with the Looker utility's existing
regex-based SQL parsing conventions - no new parsing dependency)."""
import re

from app.schemas.text_compare import DiffType, SqlComparisonDetail, SqlDiffEntry
from app.services.text_compare.comparators.base import BaseComparator, ComparatorOutput

_TABLE_REGEX = re.compile(r"\b(?:FROM|JOIN)\s+([a-zA-Z0-9_.\"`\[\]]+)", re.IGNORECASE)
_JOIN_REGEX = re.compile(
    r"((?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+[a-zA-Z0-9_.\"`\[\]]+"
    r"(?:\s+(?:AS\s+)?[a-zA-Z0-9_]+)?\s*ON\s+[^;\n]+?)"
    r"(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN|\s+WHERE|\s+GROUP|\s+ORDER|\s*$)",
    re.IGNORECASE | re.DOTALL,
)
_WHERE_REGEX = re.compile(r"\bWHERE\b(.*?)(?:\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|;|$)", re.IGNORECASE | re.DOTALL)
_SELECT_REGEX = re.compile(r"\bSELECT\b(.*?)\bFROM\b", re.IGNORECASE | re.DOTALL)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().rstrip(",").lower()


def _split_top_level(clause: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current = ""
    for char in clause:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += char
    if current.strip():
        parts.append(current)
    return parts


def _extract_tables(sql: str) -> set[str]:
    return {_normalize(match) for match in _TABLE_REGEX.findall(sql)}


def _extract_joins(sql: str) -> set[str]:
    return {_normalize(match) for match in _JOIN_REGEX.findall(sql)}


def _extract_filters(sql: str) -> set[str]:
    match = _WHERE_REGEX.search(sql)
    if not match:
        return set()
    parts = re.split(r"\bAND\b|\bOR\b", match.group(1), flags=re.IGNORECASE)
    return {_normalize(part) for part in parts if _normalize(part)}


def _extract_columns(sql: str) -> set[str]:
    match = _SELECT_REGEX.search(sql)
    if not match:
        return set()
    clause = match.group(1)
    if clause.strip() == "*":
        return {"*"}
    return {_normalize(part) for part in _split_top_level(clause) if _normalize(part)}


class SqlComparator(BaseComparator):
    def compare(self, text_a: str, text_b: str) -> ComparatorOutput:
        tables_a, tables_b = _extract_tables(text_a), _extract_tables(text_b)
        joins_a, joins_b = _extract_joins(text_a), _extract_joins(text_b)
        filters_a, filters_b = _extract_filters(text_a), _extract_filters(text_b)
        columns_a, columns_b = _extract_columns(text_a), _extract_columns(text_b)

        tables_added, tables_removed = sorted(tables_b - tables_a), sorted(tables_a - tables_b)
        joins_added, joins_removed = sorted(joins_b - joins_a), sorted(joins_a - joins_b)
        filters_added, filters_removed = sorted(filters_b - filters_a), sorted(filters_a - filters_b)
        columns_added, columns_removed = sorted(columns_b - columns_a), sorted(columns_a - columns_b)

        entries: list[SqlDiffEntry] = []
        for category, added_items, removed_items in (
            ("table", tables_added, tables_removed),
            ("join", joins_added, joins_removed),
            ("filter", filters_added, filters_removed),
            ("column", columns_added, columns_removed),
        ):
            entries.extend(SqlDiffEntry(category=category, diff_type=DiffType.ADDED, detail=item) for item in added_items)
            entries.extend(
                SqlDiffEntry(category=category, diff_type=DiffType.REMOVED, detail=item) for item in removed_items
            )

        added = len(tables_added) + len(joins_added) + len(filters_added) + len(columns_added)
        removed = len(tables_removed) + len(joins_removed) + len(filters_removed) + len(columns_removed)
        identical = (
            len(tables_a & tables_b) + len(joins_a & joins_b) + len(filters_a & filters_b) + len(columns_a & columns_b)
        )
        total = added + removed + identical or 1
        similarity = round((identical / total) * 100, 1)

        detail = SqlComparisonDetail(
            tables_added=tables_added,
            tables_removed=tables_removed,
            joins_added=joins_added,
            joins_removed=joins_removed,
            filters_added=filters_added,
            filters_removed=filters_removed,
            columns_added=columns_added,
            columns_removed=columns_removed,
            entries=entries,
        )
        return ComparatorOutput(
            added=added,
            removed=removed,
            modified=0,
            identical=identical,
            similarity_score=similarity,
            sql_detail=detail,
        )
