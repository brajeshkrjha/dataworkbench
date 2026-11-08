"""Semantic model (.bim / TMDL) parsing.

Ported verbatim from the source tool's ``parse_model`` and support
functions. The semantic model can be stored two completely different
ways: older projects use a single ``model.bim`` JSON file, newer ones
use a folder of ``.tmdl`` text files. Both are handled here because a
real project can even mix them (JSON model.bim plus TMDL tables).
"""
import re
from pathlib import Path

import pandas as pd

from app.services.looker.file_resolution import (
    read_text,
    recursive_dicts,
    safe_json_dumps,
    safe_json_load,
)
from app.services.looker.text_utils import (
    TABLE_FIELD_REGEX,
    clean_query_text,
    extract_source_name,
    extract_sql_fragment,
    extract_sql_tables,
)
from app.services.looker.tmdl_parser import (
    TMDL_MEASURE_REGEX,
    _split_measure_ref,
    extract_relationships_from_text,
    parse_table_column_ref,
    parse_tmdl_expressions,
    parse_tmdl_role,
    parse_tmdl_table,
)

SHARED_QUERY_REGEX = re.compile(r"\bshared\s+([A-Za-z0-9_\.\- ]+)\s*=", re.IGNORECASE)


def _dedupe_measures(rows: list) -> pd.DataFrame:
    """Build the measures frame, dropping stub rows a real parse already covers.

    The fallback regex scan in parse_model picks up measure declarations from files
    that are not TMDL tables. Those rows carry a name and nothing else, so when the
    same measure is also parsed properly the workbook ends up showing a blank
    duplicate next to the real row. Matching on name alone is safe here because
    Power BI requires measure names to be unique across the whole model.
    """
    df = pd.DataFrame(rows).drop_duplicates()
    if df.empty or "measure_name" not in df.columns:
        return df
    if "expression" not in df.columns:
        df["expression"] = ""

    name_key = df["measure_name"].fillna("").astype(str).str.strip().str.lower()
    has_expression = df["expression"].fillna("").astype(str).str.strip().ne("")
    covered = set(name_key[has_expression])

    # Keep every real definition, plus any stub whose measure was never found
    # properly - losing those would hide a measure entirely.
    keep = has_expression | ~name_key.isin(covered)
    return df[keep].reset_index(drop=True)


def parse_model(model_root: Path | None):
    # The semantic model can be stored two completely different ways: older projects
    # use a single model.bim JSON file, newer ones use a folder of .tmdl text files.
    # Both are handled here because a real project can even mix them (JSON model.bim
    # plus TMDL tables), which is exactly what tripped this up the first time round.
    model_tables = []
    model_columns = []
    model_hierarchies = []
    model_measures = []
    model_queries = []
    model_fields = []
    query_names = []
    model_relationships = []
    model_roles = []
    model_role_filters = []
    model_partitions = []
    model_perspectives = []
    model_cultures = []
    model_data_sources = []
    model_calc_groups = []
    model_parameters = []
    inventory_rows = []

    if model_root is None or not model_root.exists():
        return {
            "model_tables": pd.DataFrame(),
            "model_columns": pd.DataFrame(),
            "model_hierarchies": pd.DataFrame(),
            "model_measures": pd.DataFrame(),
            "model_queries": pd.DataFrame(),
            "model_fields": pd.DataFrame(),
            "query_names": pd.DataFrame(),
            "model_relationships": pd.DataFrame(),
            "model_roles": pd.DataFrame(),
            "model_role_filters": pd.DataFrame(),
            "model_partitions": pd.DataFrame(),
            "model_perspectives": pd.DataFrame(),
            "model_cultures": pd.DataFrame(),
            "model_data_sources": pd.DataFrame(),
            "model_calc_groups": pd.DataFrame(),
            "model_parameters": pd.DataFrame(),
            "model_inventory": pd.DataFrame(),
        }

    model_like_files = {".json", ".tmdl", ".m", ".bim", ".pbism", ".dax"}
    for fp in model_root.rglob("*"):
        if not fp.is_file():
            continue

        rel = fp.relative_to(model_root).as_posix()
        inventory_rows.append(
            {
                "file_path": rel,
                "extension": fp.suffix.lower(),
                "size_bytes": fp.stat().st_size,
            }
        )

        if fp.suffix.lower() not in model_like_files:
            continue

        txt = read_text(fp)
        if not txt:
            continue

        for name in SHARED_QUERY_REGEX.findall(txt):
            query_names.append({"file_path": rel, "query_name": name.strip()})

        for table_name, field_name in TABLE_FIELD_REGEX.findall(txt):
            model_fields.append(
                {
                    "file_path": rel,
                    "table_name": table_name,
                    "field_or_measure": field_name,
                    "source": "model_text",
                }
            )

        is_tmdl_table = fp.suffix.lower() == ".tmdl" and re.search(r"^table\s+", txt, re.MULTILINE) is not None
        is_tmdl_role = fp.suffix.lower() == ".tmdl" and re.search(r"^role\s+", txt, re.MULTILINE) is not None
        is_tmdl_expressions = fp.suffix.lower() == ".tmdl" and re.search(r"^expression\s+", txt, re.MULTILINE) is not None

        if is_tmdl_role:
            role_parsed = parse_tmdl_role(txt)
            rname = role_parsed.get("role_name") or ""
            if rname:
                model_roles.append(
                    {
                        "file_path": rel,
                        "role_name": rname,
                        "model_permission": role_parsed.get("model_permission", ""),
                        "members_count": len(role_parsed.get("filters", [])),
                    }
                )
                for flt in role_parsed.get("filters", []):
                    model_role_filters.append(
                        {
                            "file_path": rel,
                            "role_name": rname,
                            "table_name": flt.get("table_name", ""),
                            "filter_expression": flt.get("filter_expression", ""),
                        }
                    )

        if is_tmdl_expressions and not is_tmdl_table:
            for expr_row in parse_tmdl_expressions(txt):
                model_parameters.append(
                    {
                        "file_path": rel,
                        "name": expr_row.get("name", ""),
                        "kind": expr_row.get("kind", ""),
                        "expression": expr_row.get("expression", ""),
                    }
                )
                expr_text = expr_row.get("expression", "")
                if expr_text:
                    model_queries.append(
                        {
                            "file_path": rel,
                            "query_name": expr_row.get("name", ""),
                            "navigation_step": "",
                            "source_name": expr_row.get("source_name", ""),
                            "is_direct_query": "",
                            "result_type": expr_row.get("kind", ""),
                            "is_hidden": "",
                            "m_query_clean": expr_text[:20000],
                            "native_sql_clean": extract_sql_fragment(expr_text),
                        }
                    )

        if is_tmdl_table:
            parsed = parse_tmdl_table(txt)
            tbl_name = parsed.get("table_name") or ""
            if tbl_name:
                model_tables.append({"table_name": tbl_name, "source_file": rel})

            for col in parsed.get("columns", []):
                model_columns.append({"file_path": rel, "table_name": tbl_name, **col})

            for hier in parsed.get("hierarchies", []):
                model_hierarchies.append({"file_path": rel, "table_name": tbl_name, **hier})

            for meas in parsed.get("measures", []):
                model_measures.append(
                    {
                        "file_path": rel,
                        "table_name": tbl_name,
                        "measure_name": meas.get("measure_name", ""),
                        "expression": meas.get("expression", ""),
                        "display_folder": meas.get("display_folder", ""),
                        "is_hidden": meas.get("is_hidden", ""),
                        "format_string": meas.get("format_string", ""),
                        "description": meas.get("description", ""),
                    }
                )

            for part in parsed.get("partitions", []):
                expr = part.get("expression", "")
                model_partitions.append(
                    {
                        "file_path": rel,
                        "table_name": tbl_name,
                        "partition_name": part.get("partition_name", ""),
                        "mode": part.get("mode", ""),
                        "source_type": part.get("partition_kind", ""),
                        "expression_or_query": expr[:12000],
                    }
                )

                if not expr:
                    continue

                native_sql = extract_sql_fragment(expr)
                model_queries.append(
                    {
                        "file_path": rel,
                        "query_name": tbl_name or part.get("partition_name", ""),
                        "navigation_step": "",
                        "source_name": extract_source_name(expr),
                        "is_direct_query": "yes" if str(part.get("mode", "")).lower() == "directquery" else "",
                        "result_type": part.get("partition_kind", ""),
                        "is_hidden": "",
                        "m_query_clean": expr[:20000],
                        "native_sql_clean": native_sql,
                    }
                )
        else:
            # Fallback scan for files that are not recognised as TMDL tables. It only
            # recovers a name, so these rows are stubs - _dedupe_measures drops any that
            # the proper table parse already covers. Names arrive both plain and fully
            # qualified, hence the split.
            for mname in TMDL_MEASURE_REGEX.findall(txt):
                ref_table, ref_name = _split_measure_ref(mname)
                if not ref_name:
                    continue
                model_measures.append(
                    {
                        "file_path": rel,
                        "table_name": ref_table,
                        "measure_name": ref_name,
                        "expression": "",
                    }
                )

        if fp.suffix.lower() in {".m", ".pq", ".pqm"} and ("source =" in txt.lower() or "shared " in txt.lower()):
            cleaned_txt = clean_query_text(txt)
            model_queries.append(
                {
                    "file_path": rel,
                    "query_name": "",
                    "navigation_step": "",
                    "source_name": extract_source_name(cleaned_txt),
                    "is_direct_query": "",
                    "result_type": "",
                    "is_hidden": "",
                    "m_query_clean": cleaned_txt[:20000],
                    "native_sql_clean": extract_sql_fragment(cleaned_txt),
                }
            )

        obj = safe_json_load(fp)
        if isinstance(obj, dict):
            if isinstance(obj.get("expressions"), list):
                for expr in obj.get("expressions") or []:
                    if not isinstance(expr, dict):
                        continue
                    model_parameters.append(
                        {
                            "file_path": rel,
                            "name": expr.get("name"),
                            "kind": expr.get("kind") or expr.get("type"),
                            "expression": clean_query_text(str(expr.get("expression") or ""))[:8000],
                        }
                    )

            if isinstance(obj.get("queries"), list):
                for q in obj.get("queries") or []:
                    if not isinstance(q, dict):
                        continue
                    qname = str(q.get("name") or "").strip()
                    nav = str(q.get("navigationStepName") or "").strip()
                    is_dq = q.get("isDirectQuery")
                    result_type = q.get("resultType")
                    is_hidden = q.get("isHidden")

                    text_obj = q.get("text")
                    if isinstance(text_obj, list):
                        m_text = "\n".join(str(x) for x in text_obj)
                    elif isinstance(text_obj, str):
                        m_text = text_obj
                    else:
                        m_text = ""

                    cleaned_m = clean_query_text(m_text)
                    native_sql = extract_sql_fragment(cleaned_m)
                    source_name = extract_source_name(cleaned_m)

                    model_queries.append(
                        {
                            "file_path": rel,
                            "query_name": qname,
                            "navigation_step": nav,
                            "source_name": source_name,
                            "is_direct_query": is_dq,
                            "result_type": result_type,
                            "is_hidden": is_hidden,
                            "m_query_clean": cleaned_m[:20000],
                            "native_sql_clean": native_sql,
                        }
                    )

                    for table_ref in extract_sql_tables(native_sql):
                        model_tables.append({"table_name": table_ref, "source_file": rel})

            model_obj = obj.get("model") if isinstance(obj.get("model"), dict) else obj

            for ds in model_obj.get("dataSources", []) or []:
                if isinstance(ds, dict):
                    model_data_sources.append(
                        {
                            "file_path": rel,
                            "name": ds.get("name"),
                            "type": ds.get("type"),
                            "connection_details": safe_json_dumps(ds, limit=8000),
                        }
                    )

            for reln in model_obj.get("relationships", []) or []:
                if isinstance(reln, dict):
                    ft = reln.get("fromTable")
                    fc = reln.get("fromColumn")
                    tt = reln.get("toTable")
                    tc = reln.get("toColumn")

                    if (not ft or not tt) and fc and tc:
                        parsed_f = parse_table_column_ref(str(fc))
                        parsed_t = parse_table_column_ref(str(tc))
                        if parsed_f and parsed_t:
                            ft, fc = parsed_f
                            tt, tc = parsed_t

                    model_relationships.append(
                        {
                            "file_path": rel,
                            "name": reln.get("name"),
                            "from_table": ft,
                            "from_column": fc,
                            "to_table": tt,
                            "to_column": tc,
                            "is_active": reln.get("isActive"),
                            "cross_filtering_behavior": reln.get("crossFilteringBehavior"),
                            "cardinality": reln.get("cardinality"),
                        }
                    )

            # Fallback JSON scan for relationship-like objects in newer/variant semantic model formats.
            for node in recursive_dicts(obj):
                if not isinstance(node, dict):
                    continue
                ft = node.get("fromTable")
                fc = node.get("fromColumn")
                tt = node.get("toTable")
                tc = node.get("toColumn")
                if (not ft or not tt) and fc and tc:
                    parsed_f = parse_table_column_ref(str(fc))
                    parsed_t = parse_table_column_ref(str(tc))
                    if parsed_f and parsed_t:
                        ft, fc = parsed_f
                        tt, tc = parsed_t
                if ft and fc and tt and tc:
                    model_relationships.append(
                        {
                            "file_path": rel,
                            "name": node.get("name"),
                            "from_table": ft,
                            "from_column": fc,
                            "to_table": tt,
                            "to_column": tc,
                            "is_active": node.get("isActive"),
                            "cross_filtering_behavior": node.get("crossFilteringBehavior"),
                            "cardinality": node.get("cardinality"),
                        }
                    )

            for role in model_obj.get("roles", []) or []:
                if not isinstance(role, dict):
                    continue
                rname = role.get("name")
                members = role.get("members", []) or []
                model_roles.append(
                    {
                        "file_path": rel,
                        "role_name": rname,
                        "model_permission": role.get("modelPermission"),
                        "members_count": len(members),
                    }
                )
                for tp in role.get("tablePermissions", []) or []:
                    if isinstance(tp, dict):
                        model_role_filters.append(
                            {
                                "file_path": rel,
                                "role_name": rname,
                                "table_name": tp.get("name") or tp.get("table"),
                                "filter_expression": clean_query_text(str(tp.get("filterExpression") or ""))[:8000],
                            }
                        )

            for pers in model_obj.get("perspectives", []) or []:
                if not isinstance(pers, dict):
                    continue
                pname = pers.get("name")
                for pt in pers.get("tables", []) or []:
                    if not isinstance(pt, dict):
                        continue
                    table_name = pt.get("name")
                    for col in pt.get("columns", []) or []:
                        if isinstance(col, dict):
                            model_perspectives.append(
                                {
                                    "file_path": rel,
                                    "perspective_name": pname,
                                    "table_name": table_name,
                                    "object_type": "column",
                                    "object_name": col.get("name"),
                                }
                            )
                    for mea in pt.get("measures", []) or []:
                        if isinstance(mea, dict):
                            model_perspectives.append(
                                {
                                    "file_path": rel,
                                    "perspective_name": pname,
                                    "table_name": table_name,
                                    "object_type": "measure",
                                    "object_name": mea.get("name"),
                                }
                            )
                    for h in pt.get("hierarchies", []) or []:
                        if isinstance(h, dict):
                            model_perspectives.append(
                                {
                                    "file_path": rel,
                                    "perspective_name": pname,
                                    "table_name": table_name,
                                    "object_type": "hierarchy",
                                    "object_name": h.get("name"),
                                }
                            )

            for cul in model_obj.get("cultures", []) or []:
                if isinstance(cul, dict):
                    model_cultures.append(
                        {
                            "file_path": rel,
                            "culture": cul.get("name"),
                            "linguistic_metadata": cul.get("linguisticMetadata"),
                            "translations_count": len(cul.get("translations", []) or []),
                        }
                    )

            tables = model_obj.get("tables") if isinstance(model_obj.get("tables"), list) else []
            for t in tables:
                tname = t.get("name")
                if tname:
                    model_tables.append({"table_name": tname, "source_file": rel})
                if isinstance(t.get("calculationGroup"), dict):
                    cg = t.get("calculationGroup")
                    model_calc_groups.append(
                        {
                            "file_path": rel,
                            "table_name": tname,
                            "precedence": cg.get("precedence"),
                            "calculation_items": len(cg.get("calculationItems", []) or []),
                        }
                    )
                for m in t.get("measures", []) or []:
                    mname = m.get("name")
                    if mname:
                        model_measures.append(
                            {
                                "file_path": rel,
                                "table_name": tname,
                                "measure_name": mname,
                                "expression": clean_query_text(str(m.get("expression") or ""))[:12000],
                            }
                        )
                for p in t.get("partitions", []) or []:
                    src = p.get("source") if isinstance(p.get("source"), dict) else {}
                    expr = src.get("expression") or src.get("query")
                    model_partitions.append(
                        {
                            "file_path": rel,
                            "table_name": tname,
                            "partition_name": p.get("name"),
                            "mode": p.get("mode"),
                            "source_type": src.get("type") if isinstance(src, dict) else None,
                            "expression_or_query": clean_query_text(str(expr or ""))[:12000],
                        }
                    )
                    if expr:
                        model_queries.append(
                            {
                                "file_path": rel,
                                "query_name": f"partition:{p.get('name')}",
                                "navigation_step": "",
                                "source_name": src.get("type") if isinstance(src, dict) else "",
                                "is_direct_query": "",
                                "result_type": "",
                                "is_hidden": "",
                                "m_query_clean": clean_query_text(str(expr))[:20000],
                                "native_sql_clean": "",
                            }
                        )

        # Text fallback (mainly for .tmdl) when relationship objects are not present as JSON arrays.
        model_relationships.extend(extract_relationships_from_text(txt, rel))

    q_df = pd.DataFrame(model_queries).drop_duplicates()
    for c in ["native_sql_clean", "m_query_clean", "query_name", "navigation_step", "source_name", "is_direct_query", "result_type", "is_hidden", "file_path"]:
        if c not in q_df.columns:
            q_df[c] = ""
    if not q_df.empty:
        q_df["native_sql_clean"] = q_df["native_sql_clean"].fillna("")
        q_df["m_query_clean"] = q_df["m_query_clean"].fillna("")
        q_df["query_pretty"] = q_df.apply(
            lambda r: r["native_sql_clean"] if str(r["native_sql_clean"]).strip() else r["m_query_clean"], axis=1
        )

    return {
        "model_tables": pd.DataFrame(model_tables).drop_duplicates(),
        "model_columns": pd.DataFrame(model_columns).drop_duplicates(),
        "model_hierarchies": pd.DataFrame(model_hierarchies).drop_duplicates(),
        "model_measures": _dedupe_measures(model_measures),
        "model_queries": q_df,
        "model_fields": pd.DataFrame(model_fields).drop_duplicates(),
        "query_names": pd.DataFrame(query_names).drop_duplicates(),
        "model_relationships": pd.DataFrame(model_relationships).drop_duplicates(),
        "model_roles": pd.DataFrame(model_roles).drop_duplicates(),
        "model_role_filters": pd.DataFrame(model_role_filters).drop_duplicates(),
        "model_partitions": pd.DataFrame(model_partitions).drop_duplicates(),
        "model_perspectives": pd.DataFrame(model_perspectives).drop_duplicates(),
        "model_cultures": pd.DataFrame(model_cultures).drop_duplicates(),
        "model_data_sources": pd.DataFrame(model_data_sources).drop_duplicates(),
        "model_calc_groups": pd.DataFrame(model_calc_groups).drop_duplicates(),
        "model_parameters": pd.DataFrame(model_parameters).drop_duplicates(),
        "model_inventory": pd.DataFrame(inventory_rows),
    }
