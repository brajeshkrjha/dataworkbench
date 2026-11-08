"""Automatic content-type detection for the Text Compare Utility.

Detection is extension-first (when a file name is available), falling
back to content sniffing so pasted text still gets a sensible default.
"""
import json
import re

from app.schemas.text_compare import ComparisonInputType

_EXTENSION_MAP: dict[str, ComparisonInputType] = {
    "json": ComparisonInputType.JSON,
    "yaml": ComparisonInputType.YAML,
    "yml": ComparisonInputType.YAML,
    "xml": ComparisonInputType.XML,
    "csv": ComparisonInputType.CSV,
    "tsv": ComparisonInputType.CSV,
    "sql": ComparisonInputType.SQL,
    "lkml": ComparisonInputType.LOOKML,
    "lookml": ComparisonInputType.LOOKML,
    "dax": ComparisonInputType.DAX,
    "txt": ComparisonInputType.TEXT,
}

_SQL_KEYWORDS = re.compile(r"^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|MERGE)\b", re.IGNORECASE)
_LOOKML_PATTERN = re.compile(
    r"^\s*(view|explore|dimension|measure|dimension_group)\s*:\s*\w*\s*{", re.IGNORECASE | re.MULTILINE
)
_DAX_PATTERN = re.compile(r"\b(CALCULATE|ALLEXCEPT|SUMX|VAR\s+\w+\s*=|RETURN)\b", re.IGNORECASE)


def detect_type(content: str, file_name: str | None) -> ComparisonInputType:
    if file_name and "." in file_name:
        extension = file_name.rsplit(".", 1)[-1].lower()
        if extension in _EXTENSION_MAP:
            return _EXTENSION_MAP[extension]

    stripped = content.strip()
    if not stripped:
        return ComparisonInputType.TEXT

    if stripped.startswith("<"):
        return ComparisonInputType.XML

    if stripped[0] in "{[":
        try:
            json.loads(stripped)
            return ComparisonInputType.JSON
        except ValueError:
            pass

    if _LOOKML_PATTERN.search(stripped):
        return ComparisonInputType.LOOKML

    if _SQL_KEYWORDS.match(stripped):
        return ComparisonInputType.SQL

    if _DAX_PATTERN.search(stripped):
        return ComparisonInputType.DAX

    lines = [line for line in stripped.splitlines() if line.strip()]
    if len(lines) >= 2:
        for delimiter in (",", "\t", ";"):
            counts = {line.count(delimiter) for line in lines[:5]}
            if len(counts) == 1 and counts != {0}:
                return ComparisonInputType.CSV

    try:
        import yaml

        parsed = yaml.safe_load(stripped)
        if isinstance(parsed, (dict, list)) and (":" in stripped or stripped.lstrip().startswith("-")):
            return ComparisonInputType.YAML
    except Exception:  # noqa: BLE001
        return ComparisonInputType.TEXT

    return ComparisonInputType.TEXT
