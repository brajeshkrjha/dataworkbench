"""Usage analysis: cross-references parsed report + model data.

Ported verbatim from the source tool's ``build_query_catalog`` and
``build_clean_views`` (Excel-styling helpers such as ``build_summary``,
``build_additional_data`` and ``style_sheet`` are intentionally
excluded - documentation-workbook generation is out of scope for the
GCP Looker Utility).
"""
import re

import pandas as pd

from app.services.looker.text_utils import (
    detect_source_details,
    extract_sql_fragment,
    extract_sql_tables,
)

CARDINALITY_NOTES = {
    "many-to-one": "Standard star-schema join (fact → dimension).",
    "one-to-many": "Standard join defined from the dimension side.",
    "one-to-one": "Both sides unique - often a candidate to merge into one table.",
    "many-to-many": "Uses a bridge/composite key - can be slow and may double-count.",
}

DAX_REF_REGEX = re.compile(r"\[([^\[\]]+)\]")


def _join_unique(values):
    clean = sorted({str(v).strip() for v in values if str(v).strip()})
    return ", ".join(clean)


def _clean_cell(value) -> str:
    """Normalise a DataFrame value to a display string.

    Rows built by the fallback measure scanners do not carry every key, so
    pandas fills the gap with NaN. NaN is truthy, which meant a plain
    `str(x or "")` turned an absent display folder into the literal text
    "nan" in the workbook.
    """
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).strip()


def _resolve_indirect_measure_usage(model_measures, direct_usage: dict) -> dict:
    """Work out which tabs a measure feeds *indirectly* via other measures.

    Only measures dropped straight onto a visual show up in the report files,
    so a helper measure that does the real work but is never placed on a page
    looked completely unused. That reads as "the tool missed it", when in fact
    the measure is very much in play -- just one level down.

    This walks the reference graph the other way: if measure A is on tab X and
    A's DAX contains [B], then B is credited to tab X too. Repeats until
    nothing new is found, so a chain A -> B -> C also credits C. Self
    references and circular chains are handled by only ever adding tabs, and
    by capping the number of passes.
    """
    if model_measures is None or model_measures.empty:
        return {}

    known = {}
    for _, row in model_measures.iterrows():
        name = str(row.get("measure_name") or "").strip()
        if name:
            known.setdefault(name.lower(), name)

    # measure -> set of other measures it references
    refs = {}
    for _, row in model_measures.iterrows():
        name = str(row.get("measure_name") or "").strip()
        if not name:
            continue
        expr = str(row.get("expression") or "")
        if not expr:
            continue
        hits = set()
        for token in DAX_REF_REGEX.findall(expr):
            key = token.strip().lower()
            if key in known and key != name.lower():
                hits.add(key)
        if hits:
            refs[name.lower()] = hits

    resolved = {k: set(v) for k, v in direct_usage.items() if v}

    # Fixed point. The cap is a safety net for pathological models; real
    # reference chains are only a few levels deep.
    for _ in range(12):
        changed = False
        for parent_key, child_keys in refs.items():
            parent_tabs = resolved.get(parent_key)
            if not parent_tabs:
                continue
            for child_key in child_keys:
                before = resolved.setdefault(child_key, set())
                if not parent_tabs.issubset(before):
                    before.update(parent_tabs)
                    changed = True
        if not changed:
            break

    return resolved


def build_query_catalog(model_data: dict):
    if model_data["model_queries"].empty:
        return pd.DataFrame(), pd.DataFrame()

    qdf = model_data["model_queries"].copy()
    if "query_name" not in qdf.columns:
        qdf["query_name"] = ""

    catalog_cols = [
        c
        for c in [
            "query_name",
            "source_name",
            "navigation_step",
            "is_direct_query",
            "result_type",
            "is_hidden",
            "file_path",
        ]
        if c in qdf.columns
    ]
    queries_catalog = qdf[catalog_cols].drop_duplicates()
    if not queries_catalog.empty:
        queries_catalog = queries_catalog.sort_values([c for c in ["query_name", "source_name"] if c in queries_catalog.columns])

    map_rows = []
    for _, row in qdf.iterrows():
        qname = str(row.get("query_name") or "")
        src = str(row.get("source_name") or "")
        sql_text = str(row.get("native_sql_clean") or "")
        for t in extract_sql_tables(sql_text):
            map_rows.append(
                {
                    "query_name": qname,
                    "source_name": src,
                    "table_name": t,
                }
            )

    query_table_map = pd.DataFrame(map_rows).drop_duplicates()
    if not query_table_map.empty:
        query_table_map = query_table_map.sort_values(["query_name", "table_name"])

    return queries_catalog, query_table_map


def build_clean_views(report_data: dict, model_data: dict):
    # The raw frames carry a lot of internal columns nobody wants to read, so each
    # view here is rebuilt row by row with only the useful fields, cross-referenced
    # against the report so we can show which tabs each measure/column feeds.
    report_fields = report_data.get("report_fields", pd.DataFrame())
    model_measures = model_data.get("model_measures", pd.DataFrame())
    relationships = model_data.get("model_relationships", pd.DataFrame())
    model_tables = model_data.get("model_tables", pd.DataFrame())
    model_queries = model_data.get("model_queries", pd.DataFrame())

    _, query_table_map = build_query_catalog(model_data)

    # ---- Measures used (clean) ----
    # First pass: tabs where the measure is placed on a visual directly.
    direct_usage = {}
    if not model_measures.empty and not report_fields.empty and "field_or_measure" in report_fields.columns:
        rf_names = report_fields["field_or_measure"].astype(str).str.lower()
        for _, m in model_measures.iterrows():
            mname = str(m.get("measure_name") or "").strip()
            if not mname:
                continue
            match = report_fields[rf_names == mname.lower()]
            if not match.empty and "tab_display_name" in match.columns:
                found = {t for t in match["tab_display_name"].fillna("").astype(str).tolist() if t.strip()}
                if found:
                    direct_usage[mname.lower()] = found

    # Second pass: credit helper measures for the tabs their callers appear on.
    all_usage = _resolve_indirect_measure_usage(model_measures, direct_usage)

    measure_rows = []
    if not model_measures.empty:
        for _, m in model_measures.iterrows():
            mname = str(m.get("measure_name") or "").strip()
            if not mname:
                continue
            tname = str(m.get("table_name") or "").strip()
            expr = str(m.get("expression") or "").strip()
            key = mname.lower()
            direct = direct_usage.get(key, set())
            every = all_usage.get(key, set())
            indirect = every - direct
            # Keep the two apart so a reviewer can still tell what is actually
            # on a page from what is only reached through another measure.
            usage_kind = "Direct" if direct else ("Indirect" if indirect else "Not on any page")

            measure_rows.append(
                {
                    "measure_name": mname,
                    "table_name": tname,
                    "display_folder": _clean_cell(m.get("display_folder")),
                    "is_hidden": _clean_cell(m.get("is_hidden")),
                    "format_string": _clean_cell(m.get("format_string")),
                    "usage": usage_kind,
                    "used_in_tabs": _join_unique(sorted(direct)),
                    "used_via_other_measures": _join_unique(sorted(indirect)),
                    "expression": expr,
                }
            )
    measures_used_df = pd.DataFrame(measure_rows).drop_duplicates()
    if not measures_used_df.empty:
        measures_used_df = measures_used_df.sort_values(["table_name", "measure_name"])

    # ---- Tables used (clean) ----
    table_names = set()
    if not model_tables.empty:
        table_names.update(model_tables["table_name"].dropna().astype(str).tolist())
    if not report_fields.empty and "table_name" in report_fields.columns:
        table_names.update(report_fields["table_name"].dropna().astype(str).tolist())
    if not relationships.empty:
        table_names.update(relationships["from_table"].dropna().astype(str).tolist())
        table_names.update(relationships["to_table"].dropna().astype(str).tolist())

    table_rows = []
    for t in sorted({x.strip() for x in table_names if str(x).strip()}):
        tabs = []
        queries = []
        related = []

        if not report_fields.empty and "table_name" in report_fields.columns:
            rf = report_fields[report_fields["table_name"].astype(str).str.lower() == t.lower()]
            if not rf.empty and "tab_display_name" in rf.columns:
                tabs = rf["tab_display_name"].fillna("").astype(str).tolist()

        if not query_table_map.empty:
            qt = query_table_map[query_table_map["table_name"].astype(str).str.lower() == t.lower()]
            if not qt.empty:
                queries = qt["query_name"].fillna("").astype(str).tolist()

        if not relationships.empty:
            r1 = relationships[relationships["from_table"].astype(str).str.lower() == t.lower()]
            r2 = relationships[relationships["to_table"].astype(str).str.lower() == t.lower()]
            related.extend(r1["to_table"].fillna("").astype(str).tolist())
            related.extend(r2["from_table"].fillna("").astype(str).tolist())

        table_rows.append(
            {
                "table_name": t,
                "used_in_tabs": _join_unique(tabs),
                "used_in_queries": _join_unique(queries),
                "related_tables": _join_unique(related),
            }
        )

    tables_used_df = pd.DataFrame(table_rows)

    # ---- Queries used (clean) ----
    query_rows = []
    if not model_queries.empty:
        working = model_queries.copy()
        if "query_pretty" not in working.columns:
            working["query_pretty"] = ""
        if "query_name" not in working.columns:
            working["query_name"] = ""
        if "source_name" not in working.columns:
            working["source_name"] = ""

        for idx, q in working.iterrows():
            qname = str(q.get("query_name") or "").strip() or f"query_{idx + 1}"
            source = str(q.get("source_name") or "").strip()
            m_text = str(q.get("m_query_clean") or "").strip()
            qtxt = str(q.get("query_pretty") or "").strip()
            sql_text = str(q.get("native_sql_clean") or "").strip()
            details = detect_source_details(source_name=source, m_query=m_text, query_text=qtxt)

            final_query_text = sql_text if sql_text else qtxt
            if details["source_type"] == "snowflake":
                final_query_text = sql_text if sql_text else extract_sql_fragment(m_text or qtxt)

            referenced_tables = extract_sql_tables(sql_text if sql_text else qtxt)

            tabs_using = []
            if referenced_tables and not report_fields.empty and "table_name" in report_fields.columns:
                rf = report_fields.copy()
                rf["_tbl"] = rf["table_name"].astype(str).str.lower()
                rf = rf[rf["_tbl"].isin([t.lower() for t in referenced_tables])]
                if not rf.empty and "tab_display_name" in rf.columns:
                    tabs_using = rf["tab_display_name"].fillna("").astype(str).tolist()

            tables_loaded = []
            # Prefer exact query-to-table mapping (query specific)
            if not query_table_map.empty and "query_name" in query_table_map.columns:
                qt = query_table_map[query_table_map["query_name"].fillna("").astype(str).str.lower() == qname.lower()]
                if not qt.empty and "table_name" in qt.columns:
                    tables_loaded.extend(qt["table_name"].fillna("").astype(str).tolist())

            # Fallback: query name often matches table name in semantic model
            if not tables_loaded and not model_tables.empty and "table_name" in model_tables.columns:
                tm2 = model_tables[model_tables["table_name"].fillna("").astype(str).str.lower() == qname.lower()]
                if not tm2.empty:
                    tables_loaded.extend(tm2["table_name"].fillna("").astype(str).tolist())

            query_rows.append(
                {
                    "query_name": qname,
                    "source_name": source,
                    "source_type": details["source_type"],
                    "warehouse_name": details["warehouse_name"],
                    "role_name": details["role_name"],
                    "database_name": details["database_name"],
                    "used_by": _join_unique([f"Tab:{t}" for t in tabs_using] + [f"Table:{t}" for t in tables_loaded]),
                    "tables_referenced": _join_unique(referenced_tables),
                    "query_text": final_query_text,
                }
            )

    queries_used_df = pd.DataFrame(query_rows).drop_duplicates()
    if not queries_used_df.empty:
        queries_used_df = queries_used_df.sort_values(["query_name", "source_name"])

    # ---- Relationships (clean) ----
    rel_df = pd.DataFrame()
    if not relationships.empty:
        rel_cols = [
            c
            for c in [
                "from_table",
                "from_column",
                "to_table",
                "to_column",
                "is_active",
                "cross_filtering_behavior",
                "cardinality",
            ]
            if c in relationships.columns
        ]
        rel_df = relationships[rel_cols].drop_duplicates()
        if not rel_df.empty:
            # Business-readable extras so the tab explains itself.
            if "cardinality" in rel_df.columns:
                symbols = {
                    "many-to-one": "*  ->  1",
                    "one-to-many": "1  ->  *",
                    "one-to-one": "1  ->  1",
                    "many-to-many": "*  ->  *",
                }
                card = rel_df["cardinality"].fillna("").astype(str).str.lower()
                rel_df.insert(rel_df.columns.get_loc("cardinality") + 1, "cardinality_symbol", card.map(symbols).fillna(""))
                rel_df["notes"] = card.map(CARDINALITY_NOTES).fillna("")
            if "cross_filtering_behavior" in rel_df.columns:
                rel_df["filter_direction"] = (
                    rel_df["cross_filtering_behavior"]
                    .fillna("")
                    .astype(str)
                    .str.lower()
                    .map({"bothdirections": "Both", "singledirection": "Single", "automatic": "Automatic"})
                    .fillna("Single")
                )
            if "is_active" in rel_df.columns:
                rel_df["status"] = (
                    rel_df["is_active"].fillna("true").astype(str).str.lower().map({"false": "Inactive"}).fillna("Active")
                )
            rel_df = rel_df.sort_values([c for c in ["from_table", "to_table", "from_column", "to_column"] if c in rel_df.columns])

    # ---- Columns (clean) ----
    model_columns = model_data.get("model_columns", pd.DataFrame())
    columns_df = pd.DataFrame()
    if not model_columns.empty:
        col_order = [
            "table_name",
            "column_name",
            "data_type",
            "is_calculated",
            "is_hidden",
            "display_folder",
            "format_string",
            "summarize_by",
            "sort_by_column",
            "source_column",
            "data_category",
            "description",
            "expression",
        ]
        keep = [c for c in col_order if c in model_columns.columns]
        columns_df = model_columns[keep].drop_duplicates()
        if not columns_df.empty:
            columns_df = columns_df.sort_values([c for c in ["table_name", "column_name"] if c in columns_df.columns])

    # -------- Hierarchies (clean)
    model_hierarchies = model_data.get("model_hierarchies", pd.DataFrame())
    hierarchies_df = pd.DataFrame()
    if not model_hierarchies.empty:
        keep = [c for c in ["table_name", "hierarchy_name", "level_count", "levels"] if c in model_hierarchies.columns]
        hierarchies_df = model_hierarchies[keep].drop_duplicates()

    # ---- Security / RLS (clean)
    model_roles = model_data.get("model_roles", pd.DataFrame())
    model_role_filters = model_data.get("model_role_filters", pd.DataFrame())
    security_df = pd.DataFrame()
    if not model_roles.empty:
        security_rows = []
        for _, r in model_roles.iterrows():
            rname = str(r.get("role_name") or "").strip()
            if not rname:
                continue
            tables_filtered, filters = [], []
            if not model_role_filters.empty and "role_name" in model_role_filters.columns:
                rf = model_role_filters[model_role_filters["role_name"].astype(str).str.lower() == rname.lower()]
                tables_filtered = rf.get("table_name", pd.Series(dtype=str)).fillna("").astype(str).tolist()
                filters = rf.get("filter_expression", pd.Series(dtype=str)).fillna("").astype(str).tolist()
            security_rows.append(
                {
                    "role_name": rname,
                    "model_permission": str(r.get("model_permission") or "").strip(),
                    "tables_filtered": _join_unique(tables_filtered),
                    "filter_count": len([f for f in filters if f]),
                    "filter_expressions": _join_unique(filters),
                }
            )
        security_df = pd.DataFrame(security_rows)
        if not security_df.empty:
            security_df = security_df.sort_values("role_name")

    # ------##--- Parameters (clean)
    model_parameters = model_data.get("model_parameters", pd.DataFrame())
    parameters_df = pd.DataFrame()
    if not model_parameters.empty:
        keep = [c for c in ["name", "kind", "source_name", "expression"] if c in model_parameters.columns]
        parameters_df = model_parameters[keep].drop_duplicates()

    return {
        "queries_used": queries_used_df,
        "tables_used": tables_used_df,
        "columns_used": columns_df,
        "measures_used": measures_used_df,
        "hierarchies": hierarchies_df,
        "relationships": rel_df,
        "security_rls": security_df,
        "parameters": parameters_df,
    }
