"""Power BI report parsing (PBIR + legacy Layout formats).

Ported verbatim from the source tool. Handles both the legacy
single-blob ``Layout`` format and the modern PBIR folder-tree format
(``definition/pages/<id>/page.json`` + one ``visual.json`` per
visual) - a project mid-migration can legitimately contain both.
"""
import json
import logging
from pathlib import Path

import pandas as pd

from app.services.looker.file_resolution import (
    read_text,
    recursive_dicts,
    safe_json_dumps,
    safe_json_load,
)
from app.services.looker.text_utils import TABLE_FIELD_REGEX

logger = logging.getLogger(__name__)


def extract_layout_sections(layout_json: dict):
    tab_rows = []
    visual_rows = []
    query_rows = []
    field_rows = []
    filter_rows = []
    bookmark_rows = []

    sections = layout_json.get("sections", []) or []
    for section in sections:
        tab_name = section.get("name")
        tab_display = section.get("displayName")
        visuals = section.get("visualContainers", []) or []
        section_filters = section.get("filters")
        if section_filters:
            filter_rows.append(
                {
                    "scope": "page",
                    "tab_name": tab_name,
                    "tab_display_name": tab_display,
                    "visual_index": "",
                    "source_file": "Layout",
                    "filter_payload": safe_json_dumps(section_filters),
                }
            )

        tab_rows.append(
            {
                "tab_name": tab_name,
                "tab_display_name": tab_display,
                "visual_count": len(visuals),
                "source_file": "Layout",
            }
        )

        for idx, visual in enumerate(visuals, start=1):
            visual_type = None
            query_text = ""
            visual_filters = visual.get("filters")
            if visual_filters:
                filter_rows.append(
                    {
                        "scope": "visual",
                        "tab_name": tab_name,
                        "tab_display_name": tab_display,
                        "visual_index": idx,
                        "source_file": "Layout",
                        "filter_payload": safe_json_dumps(visual_filters),
                    }
                )

            config_raw = visual.get("config")
            if isinstance(config_raw, str):
                try:
                    config_json = json.loads(config_raw)
                except Exception:
                    logger.debug("Ignoring unreadable visual configuration", exc_info=True)
                    config_json = None
                if isinstance(config_json, dict):
                    visual_type = ((config_json.get("singleVisual") or {}).get("visualType"))

            visual_query = visual.get("query")
            if isinstance(visual_query, str):
                query_text = visual_query

            visual_rows.append(
                {
                    "tab_name": tab_name,
                    "tab_display_name": tab_display,
                    "visual_index": idx,
                    "visual_type": visual_type,
                    "source_file": "Layout",
                }
            )

            if query_text:
                query_rows.append(
                    {
                        "tab_name": tab_name,
                        "tab_display_name": tab_display,
                        "visual_index": idx,
                        "query_text": query_text[:12000],
                        "source_file": "Layout",
                    }
                )
                for table_name, field_name in TABLE_FIELD_REGEX.findall(query_text):
                    field_rows.append(
                        {
                            "tab_name": tab_name,
                            "tab_display_name": tab_display,
                            "visual_index": idx,
                            "table_name": table_name,
                            "field_or_measure": field_name,
                            "source": "report_query",
                        }
                    )

    for bm in layout_json.get("bookmarks", []) or []:
        if isinstance(bm, dict):
            bookmark_rows.append(
                {
                    "bookmark_name": bm.get("displayName") or bm.get("name"),
                    "group_name": bm.get("groupName"),
                    "source_file": "Layout",
                    "bookmark_payload": safe_json_dumps(bm),
                }
            )

    return tab_rows, visual_rows, query_rows, field_rows, filter_rows, bookmark_rows


def _pbir_field_ref(field: dict):
    """Unwrap a PBIR field node into (entity, property, kind).

    Field nodes nest: an Aggregation wraps a Column, a HierarchyLevel wraps a
    Hierarchy, and so on. We recurse to the innermost thing that actually names
    a table and a property, and report the *outermost* kind so a summed column
    is still recognisable as an aggregation.
    """
    if not isinstance(field, dict):
        return "", "", ""

    for kind in ("Measure", "Column", "HierarchyLevel", "Hierarchy"):
        node = field.get(kind)
        if isinstance(node, dict):
            entity = (((node.get("Expression") or {}).get("SourceRef") or {}).get("Entity")) or ""
            prop = node.get("Property") or node.get("Level") or ""
            if entity or prop:
                return str(entity), str(prop), kind

    # Aggregation / arithmetic wrappers - dig into whatever they contain.
    for wrapper in ("Aggregation", "Arithmetic", "SparklineData"):
        node = field.get(wrapper)
        if isinstance(node, dict):
            inner = node.get("Expression")
            if isinstance(inner, dict):
                entity, prop, _ = _pbir_field_ref(inner)
                if entity or prop:
                    return entity, prop, wrapper
    return "", "", ""


def parse_pbir_report(report_root: Path):
    """Read the PBIR page/visual folder tree into the same row shapes as the legacy parser."""
    tab_rows, visual_rows, query_rows, field_rows, filter_rows, bookmark_rows = [], [], [], [], [], []
    pages_dir = report_root / "definition" / "pages"
    if not pages_dir.exists():
        return tab_rows, visual_rows, query_rows, field_rows, filter_rows, bookmark_rows

    for page_file in sorted(pages_dir.rglob("page.json")):
        page = safe_json_load(page_file)
        if not isinstance(page, dict):
            continue
        page_dir = page_file.parent
        tab_name = str(page.get("name") or page_dir.name)
        tab_display = str(page.get("displayName") or tab_name)
        page_rel = page_file.relative_to(report_root).as_posix()

        visual_files = sorted(page_dir.rglob("visual.json"))
        tab_rows.append(
            {
                "tab_name": tab_name,
                "tab_display_name": tab_display,
                "visual_count": len(visual_files),
                "source_file": page_rel,
            }
        )

        if page.get("filterConfig"):
            filter_rows.append(
                {
                    "scope": "page",
                    "tab_name": tab_name,
                    "tab_display_name": tab_display,
                    "visual_index": "",
                    "source_file": page_rel,
                    "filter_payload": safe_json_dumps(page.get("filterConfig")),
                }
            )

        for idx, vf in enumerate(visual_files, start=1):
            obj = safe_json_load(vf)
            if not isinstance(obj, dict):
                continue
            vis = obj.get("visual") if isinstance(obj.get("visual"), dict) else {}
            vis_rel = vf.relative_to(report_root).as_posix()
            # A visualGroup has no visualType of its own; label it so the count still adds up.
            visual_type = vis.get("visualType") or ("visualGroup" if obj.get("visualGroup") else "")

            visual_rows.append(
                {
                    "tab_name": tab_name,
                    "tab_display_name": tab_display,
                    "visual_index": idx,
                    "visual_type": visual_type,
                    "source_file": vis_rel,
                }
            )

            if obj.get("filterConfig") or vis.get("filterConfig"):
                filter_rows.append(
                    {
                        "scope": "visual",
                        "tab_name": tab_name,
                        "tab_display_name": tab_display,
                        "visual_index": idx,
                        "source_file": vis_rel,
                        "filter_payload": safe_json_dumps(obj.get("filterConfig") or vis.get("filterConfig")),
                    }
                )

            query_state = ((vis.get("query") or {}).get("queryState")) or {}
            if not isinstance(query_state, dict):
                continue

            refs = []
            for bucket_val in query_state.values():
                if not isinstance(bucket_val, dict):
                    continue
                for proj in bucket_val.get("projections") or []:
                    if not isinstance(proj, dict):
                        continue
                    entity, prop, kind = _pbir_field_ref(proj.get("field") or {})
                    # queryRef is the fallback: "Table.Field" or "Sum(Table.Field)".
                    if not (entity and prop):
                        qref = str(proj.get("queryRef") or "").strip()
                        inner = qref[qref.find("(") + 1: qref.rfind(")")] if "(" in qref and ")" in qref else qref
                        if "." in inner:
                            entity, prop = inner.split(".", 1)
                    if not (entity or prop):
                        continue
                    refs.append(str(proj.get("queryRef") or f"{entity}.{prop}"))
                    field_rows.append(
                        {
                            "tab_name": tab_name,
                            "tab_display_name": tab_display,
                            "visual_index": idx,
                            "table_name": entity,
                            "field_or_measure": prop,
                            "source": f"pbir_{(kind or 'field').lower()}",
                        }
                    )

            if refs:
                query_rows.append(
                    {
                        "tab_name": tab_name,
                        "tab_display_name": tab_display,
                        "visual_index": idx,
                        "query_text": "; ".join(dict.fromkeys(refs))[:12000],
                        "source_file": vis_rel,
                    }
                )

    for bm_file in sorted((report_root / "definition" / "bookmarks").glob("*.json")):
        bm = safe_json_load(bm_file)
        if isinstance(bm, dict):
            bookmark_rows.append(
                {
                    "bookmark_name": bm.get("displayName") or bm.get("name") or bm_file.stem,
                    "group_name": bm.get("groupName") or "",
                    "source_file": bm_file.relative_to(report_root).as_posix(),
                    "bookmark_payload": safe_json_dumps(bm),
                }
            )

    return tab_rows, visual_rows, query_rows, field_rows, filter_rows, bookmark_rows


def parse_report(report_root: Path | None):
    tab_rows = []
    visual_rows = []
    query_rows = []
    field_rows = []
    filter_rows = []
    bookmark_rows = []
    inventory_rows = []

    if report_root is None or not report_root.exists():
        return {
            "tabs": pd.DataFrame(),
            "visuals": pd.DataFrame(),
            "tab_queries": pd.DataFrame(),
            "report_fields": pd.DataFrame(),
            "report_filters": pd.DataFrame(),
            "report_bookmarks": pd.DataFrame(),
            "report_inventory": pd.DataFrame(),
        }

    for fp in report_root.rglob("*"):
        if fp.is_file():
            rel = fp.relative_to(report_root).as_posix()
            inventory_rows.append(
                {
                    "file_path": rel,
                    "extension": fp.suffix.lower(),
                    "size_bytes": fp.stat().st_size,
                }
            )

    layout_path = report_root / "Layout"
    if layout_path.exists():
        txt = read_text(layout_path)
        if txt:
            try:
                layout_json = json.loads(txt)
            except Exception:
                logger.debug("Ignoring unreadable legacy report layout", exc_info=True)
                layout_json = None
            if isinstance(layout_json, dict):
                t, v, q, f, flt, bms = extract_layout_sections(layout_json)
                tab_rows.extend(t)
                visual_rows.extend(v)
                query_rows.extend(q)
                field_rows.extend(f)
                filter_rows.extend(flt)
                bookmark_rows.extend(bms)

    # Modern PBIP saves the report as a folder tree instead of a single Layout blob.
    # Both are handled: a project mid-migration can legitimately contain the two.
    t, v, q, f, flt, bms = parse_pbir_report(report_root)
    tab_rows.extend(t)
    visual_rows.extend(v)
    query_rows.extend(q)
    field_rows.extend(f)
    filter_rows.extend(flt)
    bookmark_rows.extend(bms)

    pbir_pages = {str(r.get("source_file") or "") for r in tab_rows}

    for jf in report_root.rglob("*.json"):
        obj = safe_json_load(jf)
        if not isinstance(obj, dict):
            continue
        rel = jf.relative_to(report_root).as_posix()
        if rel in pbir_pages or jf.name in {"visual.json", "page.json"}:
            continue  # already covered by the PBIR pass

        visual_list = obj.get("visualContainers") or obj.get("visuals")
        display_name = obj.get("displayName") or obj.get("name")
        if isinstance(visual_list, list) and display_name:
            tab_key = obj.get("name") or rel
            tab_rows.append(
                {
                    "tab_name": tab_key,
                    "tab_display_name": display_name,
                    "visual_count": len(visual_list),
                    "source_file": rel,
                }
            )

            for i, vis in enumerate(visual_list, start=1):
                if not isinstance(vis, dict):
                    continue
                vtype = vis.get("visualType") or vis.get("type")
                visual_rows.append(
                    {
                        "tab_name": tab_key,
                        "tab_display_name": display_name,
                        "visual_index": i,
                        "visual_type": vtype,
                        "source_file": rel,
                    }
                )

                query_text = vis.get("query") if isinstance(vis.get("query"), str) else ""
                vis_filters = vis.get("filters")
                if vis_filters:
                    filter_rows.append(
                        {
                            "scope": "visual",
                            "tab_name": tab_key,
                            "tab_display_name": display_name,
                            "visual_index": i,
                            "source_file": rel,
                            "filter_payload": safe_json_dumps(vis_filters),
                        }
                    )
                if query_text:
                    query_rows.append(
                        {
                            "tab_name": tab_key,
                            "tab_display_name": display_name,
                            "visual_index": i,
                            "query_text": query_text[:12000],
                            "source_file": rel,
                        }
                    )
                    for table_name, field_name in TABLE_FIELD_REGEX.findall(query_text):
                        field_rows.append(
                            {
                                "tab_name": tab_key,
                                "tab_display_name": display_name,
                                "visual_index": i,
                                "table_name": table_name,
                                "field_or_measure": field_name,
                                "source": "report_query",
                            }
                        )

            for node in recursive_dicts(obj):
                if not isinstance(node, dict):
                    continue
                for k in ("filter", "filters", "filterConfig"):
                    if k in node and node.get(k):
                        filter_rows.append(
                            {
                                "scope": "report_json",
                                "tab_name": "",
                                "tab_display_name": "",
                                "visual_index": "",
                                "source_file": rel,
                                "filter_payload": safe_json_dumps(node.get(k)),
                            }
                        )

            if isinstance(obj.get("bookmarks"), list):
                for bm in obj.get("bookmarks") or []:
                    if isinstance(bm, dict):
                        bookmark_rows.append(
                            {
                                "bookmark_name": bm.get("displayName") or bm.get("name"),
                                "group_name": bm.get("groupName"),
                                "source_file": rel,
                                "bookmark_payload": safe_json_dumps(bm),
                            }
                        )

    return {
        "tabs": pd.DataFrame(tab_rows).drop_duplicates(),
        "visuals": pd.DataFrame(visual_rows).drop_duplicates(),
        "tab_queries": pd.DataFrame(query_rows).drop_duplicates(),
        "report_fields": pd.DataFrame(field_rows).drop_duplicates(),
        "report_filters": pd.DataFrame(filter_rows).drop_duplicates(),
        "report_bookmarks": pd.DataFrame(bookmark_rows).drop_duplicates(),
        "report_inventory": pd.DataFrame(inventory_rows),
    }
