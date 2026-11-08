"""Structural LookML package comparison.

Diffs two generated LookML previews (see ``preview_builder.build_lookml_preview``)
at the object level - views, explores, fields, joins - instead of raw text, so
formatting/whitespace churn never shows up as a "change". Used by the "Compare
LookML Packages" module to validate a migration before promoting it.
"""
import re

_FIELD_REGEX = re.compile(r"\b(?:dimension|dimension_group|measure)\s*:\s*(\w+)\s*\{")
_JOIN_REGEX = re.compile(r"\bjoin\s*:\s*(\w+)\s*\{")


def _field_names(lookml_text: str) -> set[str]:
    return set(_FIELD_REGEX.findall(lookml_text or ""))


def _join_names(lookml_text: str) -> set[str]:
    return set(_JOIN_REGEX.findall(lookml_text or ""))


def _index(records: list[dict], key: str) -> dict[str, dict]:
    return {str(r[key]): r for r in records}


def diff_lookml_packages(preview_a: dict, preview_b: dict) -> dict:
    """Structural diff of two ``build_lookml_preview`` results.

    ``preview_a`` is treated as "previous", ``preview_b`` as "current" -
    matching the Compare module's Package A / Package B upload order.
    """
    views_a = _index(preview_a.get("views", []), "view_name")
    views_b = _index(preview_b.get("views", []), "view_name")

    views_added = sorted(set(views_b) - set(views_a))
    views_removed = sorted(set(views_a) - set(views_b))
    common_views = sorted(set(views_a) & set(views_b))

    view_changes = []
    for name in common_views:
        fields_a = _field_names(views_a[name]["lookml"])
        fields_b = _field_names(views_b[name]["lookml"])
        added = sorted(fields_b - fields_a)
        removed = sorted(fields_a - fields_b)
        if added or removed:
            view_changes.append({"view_name": name, "fields_added": added, "fields_removed": removed})

    explores_a = _index(preview_a.get("explores", []), "explore_name")
    explores_b = _index(preview_b.get("explores", []), "explore_name")

    explores_added = sorted(set(explores_b) - set(explores_a))
    explores_removed = sorted(set(explores_a) - set(explores_b))
    common_explores = sorted(set(explores_a) & set(explores_b))

    explore_changes = []
    for name in common_explores:
        joins_a = _join_names(explores_a[name]["lookml"])
        joins_b = _join_names(explores_b[name]["lookml"])
        joins_added = sorted(joins_b - joins_a)
        joins_removed = sorted(joins_a - joins_b)
        if joins_added or joins_removed:
            explore_changes.append(
                {"explore_name": name, "joins_added": joins_added, "joins_removed": joins_removed}
            )

    risk_flags: list[str] = []
    for name in views_removed:
        risk_flags.append(f"View '{name}' was removed - any Looker content referencing it will break.")
    for name in explores_removed:
        risk_flags.append(f"Explore '{name}' was removed - any Looker content referencing it will break.")
    for change in view_changes:
        for field in change["fields_removed"]:
            risk_flags.append(
                f"Field '{field}' removed from view '{change['view_name']}' - referencing dashboards will break."
            )

    return {
        "summary": {
            "views_added": len(views_added),
            "views_removed": len(views_removed),
            "views_changed": len(view_changes),
            "explores_added": len(explores_added),
            "explores_removed": len(explores_removed),
            "explores_changed": len(explore_changes),
        },
        "views_added": views_added,
        "views_removed": views_removed,
        "view_changes": view_changes,
        "explores_added": explores_added,
        "explores_removed": explores_removed,
        "explore_changes": explore_changes,
        "risk_flags": risk_flags,
    }
