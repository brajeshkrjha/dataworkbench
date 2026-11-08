"""PBIP structure exploration.

Reshapes the already-parsed model/report data (``parse_model`` /
``parse_report`` / ``build_clean_views`` / ``classify_model_tables``, all
ported verbatim from the source tool) into a single JSON-friendly payload for
the "Explore PBIP Structure" module. No new parsing logic lives here - only
aggregation, so a user can understand a PBIP project's shape without opening
Power BI Desktop.
"""
import pandas as pd

from app.services.looker.table_classification import classify_model_tables


def _records(df: pd.DataFrame | None) -> list[dict]:
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return []
    return df.where(pd.notnull(df), None).to_dict(orient="records")


def _split_list(value) -> list[str]:
    return [part for part in str(value or "").split(", ") if part]


def build_pbip_structure(report_data: dict, model_data: dict, clean_views: dict) -> dict:
    """Aggregate a parsed PBIP project into overview/table/measure/relationship/lineage data."""
    tables_df = model_data.get("model_tables", pd.DataFrame())
    columns_df = clean_views.get("columns_used", pd.DataFrame())
    measures_df = clean_views.get("measures_used", pd.DataFrame())
    hierarchies_df = clean_views.get("hierarchies", pd.DataFrame())
    relationships_df = clean_views.get("relationships", pd.DataFrame())
    roles_df = clean_views.get("security_rls", pd.DataFrame())
    tables_used_df = clean_views.get("tables_used", pd.DataFrame())
    report_fields_df = report_data.get("report_fields", pd.DataFrame())

    classification = classify_model_tables(tables_df, model_data.get("model_relationships", pd.DataFrame()))
    fact_set = set(classification["facts"])
    dim_set = set(classification["dimensions"])
    param_set = set(classification["parameters"])

    table_names = sorted(
        {str(n).strip() for n in tables_df.get("table_name", pd.Series(dtype=str)).dropna().tolist() if str(n).strip()}
    )

    def _kind(name: str) -> str:
        if name in param_set:
            return "parameter"
        if name in fact_set:
            return "fact"
        return "dimension"

    tables = []
    for name in table_names:
        cols = columns_df[columns_df["table_name"] == name] if not columns_df.empty else pd.DataFrame()
        meas = measures_df[measures_df["table_name"] == name] if not measures_df.empty else pd.DataFrame()
        hiers = hierarchies_df[hierarchies_df["table_name"] == name] if not hierarchies_df.empty else pd.DataFrame()
        tables.append(
            {
                "table_name": name,
                "classification": _kind(name),
                "column_count": len(cols),
                "measure_count": len(meas),
                "hierarchy_count": len(hiers),
                "outbound_relationships": int(classification["outbound"].get(name, 0)),
                "inbound_relationships": int(classification["inbound"].get(name, 0)),
                "columns": [str(c) for c in cols["column_name"].tolist()] if "column_name" in cols.columns else [],
                "measures": [str(m) for m in meas["measure_name"].tolist()] if "measure_name" in meas.columns else [],
                "hierarchies": [str(h) for h in hiers["hierarchy_name"].tolist()] if "hierarchy_name" in hiers.columns else [],
            }
        )
    measures = []
    for row in _records(measures_df):
        measures.append(
            {
                "measure_name": row.get("measure_name"),
                "table_name": row.get("table_name"),
                "expression": row.get("expression"),
                "usage": row.get("usage"),
                "used_in_tabs": _split_list(row.get("used_in_tabs")),
                "used_via_other_measures": _split_list(row.get("used_via_other_measures")),
                "display_folder": row.get("display_folder"),
                "is_hidden": row.get("is_hidden"),
            }
        )

    relationships = []
    for row in _records(relationships_df):
        relationships.append(
            {
                "from_table": row.get("from_table"),
                "from_column": row.get("from_column"),
                "to_table": row.get("to_table"),
                "to_column": row.get("to_column"),
                "cardinality": row.get("cardinality"),
                "cardinality_symbol": row.get("cardinality_symbol"),
                "status": row.get("status"),
                "filter_direction": row.get("filter_direction"),
                "notes": row.get("notes"),
            }
        )

    roles = []
    for row in _records(roles_df):
        roles.append(
            {
                "role_name": row.get("role_name"),
                "model_permission": row.get("model_permission"),
                "tables_filtered": _split_list(row.get("tables_filtered")),
                "filter_count": row.get("filter_count"),
            }
        )

    # ---- Lineage: Visual -> Field/Measure -> Table -> Relationship ----
    lineage = []
    if not report_fields_df.empty:
        group_cols = [c for c in ["tab_display_name", "visual_index"] if c in report_fields_df.columns]
        if group_cols:
            for keys, group in report_fields_df.groupby(group_cols, dropna=False):
                keys = keys if isinstance(keys, tuple) else (keys,)
                key_map = dict(zip(group_cols, keys))
                fields = []
                related_tables: set[str] = set()
                for _, row in group.iterrows():
                    table_name = str(row.get("table_name") or "").strip()
                    field_name = str(row.get("field_or_measure") or "").strip()
                    if not field_name:
                        continue
                    fields.append({"field_or_measure": field_name, "table_name": table_name})
                    related_tables.add(table_name)

                if not fields:
                    continue

                relationship_hits = [
                    rel
                    for rel in relationships
                    if rel.get("from_table") in related_tables or rel.get("to_table") in related_tables
                ]

                lineage.append(
                    {
                        "tab": str(key_map.get("tab_display_name") or "").strip(),
                        "visual_index": key_map.get("visual_index"),
                        "fields": fields,
                        "relationships": relationship_hits[:10],
                    }
                )

    # ---- Statistics ----
    unused_measures = sorted(m["measure_name"] for m in measures if m["usage"] == "Not on any page")

    used_table_names = set()
    if not tables_used_df.empty:
        for row in _records(tables_used_df):
            if str(row.get("used_in_tabs") or "").strip():
                used_table_names.add(row.get("table_name"))
    unused_tables = sorted(t["table_name"] for t in tables if t["table_name"] not in used_table_names)

    largest_tables = sorted(tables, key=lambda t: t["column_count"] + t["measure_count"], reverse=True)[:10]
    largest_tables_summary = [
        {
            "table_name": t["table_name"],
            "column_count": t["column_count"],
            "measure_count": t["measure_count"],
        }
        for t in largest_tables
    ]

    complexity_score = 0.0
    if tables:
        complexity_score = round(
            (
                len(relationships) * 2
                + sum(t["measure_count"] for t in tables)
                + sum(t["column_count"] for t in tables) * 0.1
            )
            / max(len(tables), 1),
            2,
        )

    stats = {
        "total_tables": len(tables),
        "total_columns": int(sum(t["column_count"] for t in tables)),
        "total_measures": int(sum(t["measure_count"] for t in tables)),
        "total_relationships": len(relationships),
        "total_hierarchies": int(sum(t["hierarchy_count"] for t in tables)),
        "total_roles": len(roles),
        "fact_tables": len(fact_set),
        "dimension_tables": len(dim_set),
        "parameter_tables": len(param_set),
        "unused_measures": len(unused_measures),
        "unused_tables": len(unused_tables),
        "complexity_score": complexity_score,
    }

    return {
        "stats": stats,
        "tables": tables,
        "measures": measures,
        "relationships": relationships,
        "roles": roles,
        "lineage": lineage[:500],  # cap payload for very large enterprise models
        "unused_measures": unused_measures,
        "unused_tables": unused_tables,
        "largest_tables": largest_tables_summary,
    }
