"""Structured comparator for JSON, YAML, and XML: parses both sides into
nested Python objects and performs a recursive key-path diff."""
import json
import xml.etree.ElementTree as ET
from typing import Any

import yaml

from app.core.exceptions import FileParseError
from app.schemas.text_compare import (
    ComparisonInputType,
    DiffType,
    StructuredComparisonDetail,
    StructuredDiffEntry,
)
from app.services.text_compare.comparators.base import BaseComparator, ComparatorOutput

_MAX_ENTRIES = 2000


def _xml_to_dict(element: ET.Element) -> Any:
    node: dict[str, Any] = {}
    if element.attrib:
        node["@attributes"] = dict(element.attrib)

    child_map: dict[str, list[Any]] = {}
    for child in list(element):
        child_map.setdefault(child.tag, []).append(_xml_to_dict(child))
    for tag, values in child_map.items():
        node[tag] = values if len(values) > 1 else values[0]

    text = (element.text or "").strip()
    if text:
        if node:
            node["#text"] = text
        else:
            return text
    return node or None


def _parse(text: str, input_type: ComparisonInputType, side: str) -> Any:
    try:
        if input_type == ComparisonInputType.JSON:
            return json.loads(text) if text.strip() else {}
        if input_type == ComparisonInputType.YAML:
            return yaml.safe_load(text) or {}
        if input_type == ComparisonInputType.XML:
            if not text.strip():
                return {}
            root = ET.fromstring(text)
            return {root.tag: _xml_to_dict(root)}
    except Exception as exc:
        raise FileParseError(f"Version {side}", f"could not parse as {input_type.value}: {exc}") from exc
    raise FileParseError(f"Version {side}", f"unsupported structured type {input_type.value}")


def _repr(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)[:200]
    return str(value)


def _walk(path: str, a: Any, b: Any, entries: list[StructuredDiffEntry], counts: dict[str, int]) -> None:
    if len(entries) >= _MAX_ENTRIES:
        return

    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a) | set(b)):
            child_path = f"{path}.{key}" if path else str(key)
            if key not in a:
                entries.append(StructuredDiffEntry(path=child_path, diff_type=DiffType.ADDED, value_b=_repr(b[key])))
                counts["added"] += 1
            elif key not in b:
                entries.append(
                    StructuredDiffEntry(path=child_path, diff_type=DiffType.REMOVED, value_a=_repr(a[key]))
                )
                counts["removed"] += 1
            else:
                _walk(child_path, a[key], b[key], entries, counts)
    elif isinstance(a, list) and isinstance(b, list):
        for index in range(max(len(a), len(b))):
            child_path = f"{path}[{index}]"
            if index >= len(a):
                entries.append(
                    StructuredDiffEntry(path=child_path, diff_type=DiffType.ADDED, value_b=_repr(b[index]))
                )
                counts["added"] += 1
            elif index >= len(b):
                entries.append(
                    StructuredDiffEntry(path=child_path, diff_type=DiffType.REMOVED, value_a=_repr(a[index]))
                )
                counts["removed"] += 1
            else:
                _walk(child_path, a[index], b[index], entries, counts)
    else:
        if a != b:
            entries.append(
                StructuredDiffEntry(path=path or "(root)", diff_type=DiffType.MODIFIED, value_a=_repr(a), value_b=_repr(b))
            )
            counts["modified"] += 1
        else:
            counts["identical"] += 1


class StructuredComparator(BaseComparator):
    def __init__(self, input_type: ComparisonInputType) -> None:
        self.input_type = input_type

    def compare(self, text_a: str, text_b: str) -> ComparatorOutput:
        parsed_a = _parse(text_a, self.input_type, "A")
        parsed_b = _parse(text_b, self.input_type, "B")

        entries: list[StructuredDiffEntry] = []
        counts = {"added": 0, "removed": 0, "modified": 0, "identical": 0}
        _walk("", parsed_a, parsed_b, entries, counts)

        total = sum(counts.values()) or 1
        similarity = round((counts["identical"] / total) * 100, 1)

        detail = StructuredComparisonDetail(
            keys_added=counts["added"],
            keys_removed=counts["removed"],
            values_changed=counts["modified"],
            array_changes=sum(1 for entry in entries if "[" in entry.path),
            entries=entries,
        )
        return ComparatorOutput(
            added=counts["added"],
            removed=counts["removed"],
            modified=counts["modified"],
            identical=counts["identical"],
            similarity_score=similarity,
            structured_detail=detail,
        )
