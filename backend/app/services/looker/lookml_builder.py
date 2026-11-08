"""LookML generation: views, explores, and the top-level model file.

Ported verbatim from the source tool's ``build_lookml_views``,
``build_lookml_explores`` and ``build_lookml_model``.
"""
import datetime
from pathlib import Path

import pandas as pd

from app.services.looker.bigquery_translation import _bq_identifier, build_derived_table_sql
from app.services.looker.lookml_naming import (
    LOOKML_RELATIONSHIP_MAP,
    _cell,
    _dax_literal_text,
    _relationship_key_columns,
    lookml_comment_block,
    lookml_escape,
    lookml_label,
    lookml_value_format,
    safe_model_name,
    sql_table_reference,
)
from app.services.looker.sql_parsing import (
    _collect_native_sql,
    _m_column_rename_map,
    build_native_sql_column_map,
)
from app.services.looker.table_classification import classify_model_tables
from app.services.looker.text_utils import get_current_user

APP_VERSION = "1.0"


def _unique_field_name(raw_name: str, used_field_names: set[str]) -> str:
    """Allocate a field name within one view's dimension/measure namespace."""
    base = safe_model_name(raw_name)
    candidate = base
    suffix = 2
    while candidate in used_field_names:
        candidate = f"{base}_{suffix}"
        suffix += 1
    used_field_names.add(candidate)
    return candidate


def build_lookml_views(model_data: dict, clean_views: dict):
    """One LookML view per model table, with dimensions and measures.

    Returns (views, field_refs). `field_refs` maps (table_lower, column_lower) to
    the LookML field name that actually exists in the generated view. Explores
    must use it rather than re-deriving names, because a name collision or a
    recovered join key can change the emitted field name.
    """
    # Tables backed by native SQL become a `derived_table` carrying the translated
    # BigQuery query; everything else falls back to `sql_table_name`. Columns coming
    # out of a derived table are typed as strings unless they are aggregates, since
    # the projected type is not reliably known from the Power BI metadata.
    columns_df = clean_views.get("columns_used", pd.DataFrame())
    measures_df = clean_views.get("measures_used", pd.DataFrame())
    tables_df = model_data.get("model_tables", pd.DataFrame())
    relationships = clean_views.get("relationships", pd.DataFrame())

    join_cols, pk_cols = _relationship_key_columns(relationships)

    # Power BI column names are only the aliases of the report's native SQL, so that query
    # is carried through as a derived table and the columns are relabelled to match.
    native_sql_map = build_native_sql_column_map(model_data, clean_views)
    native_sql_blobs = _collect_native_sql(model_data, clean_views)

    table_names = set()
    for frame, col in ((tables_df, "table_name"), (columns_df, "table_name"), (measures_df, "table_name")):
        if isinstance(frame, pd.DataFrame) and not frame.empty and col in frame.columns:
            table_names.update(str(v).strip() for v in frame[col].dropna().unique() if str(v).strip())

    views = []
    field_refs = {}
    for table in sorted(table_names):
        view_name = safe_model_name(table)
        table_key = table.strip().lower()

        # ---- Dimensions ----
        cols = pd.DataFrame()
        if isinstance(columns_df, pd.DataFrame) and not columns_df.empty and "table_name" in columns_df.columns:
            cols = columns_df[columns_df["table_name"].astype(str).str.strip() == table]
            if "column_name" in cols.columns:
                cols = cols.drop_duplicates(subset=["column_name"])

        native_cols = native_sql_map.get(table_key, {})
        blob = native_sql_blobs.get(table_key, {})
        model_column_names = [] if cols.empty or "column_name" not in cols.columns else list(cols["column_name"])
        derived_sql = build_derived_table_sql(
            blob.get("sql", ""), _m_column_rename_map(blob.get("m", "")), model_column_names)

        body = [f"view: {view_name} {{"]
        body.append(f'  label: "{lookml_escape(lookml_label(table))}"')
        body.append("")
        if derived_sql:
            # The Power BI table is not a warehouse object, but the query behind it is.
            body.append("  derived_table: {")
            body.append("    sql:")
            body.extend(f"      {line}".rstrip() for line in derived_sql.expandtabs(4).splitlines())
            body.append("    ;;")
            body.append("  }")
            body.append("")
        else:
            # sql_table_reference() quotes each dotted part, since Power BI table names
            # routinely contain spaces/punctuation that would not parse as bare SQL.
            body.append(f"  sql_table_name: {sql_table_reference(table)} ;;")
            body.append("")

        # ---- Field name registry ----
        # Both dimensions and measures share one LookML field namespace per view, and
        # safe_model_name() collapses distinct Power BI names (e.g. differing only by case
        # or punctuation, such as "REGION" and "Region#") onto the same identifier.
        # Track every name handed out so far and suffix any repeat (_2, _3, ...)
        # instead of silently redefining a field.
        used_field_names: set[str] = set()

        # Join columns/primary keys inferred from relationships, plus a guard against
        # emitting the same source column twice (fallback scan can repeat one).
        table_pks = {c.lower() for c in pk_cols.get(table_key, set())}
        emitted_cols = set()

        if not cols.empty:
            body.append("  # ---- Dimensions ----")
            for _, col in cols.iterrows():
                col_name = _cell(col.get("column_name"))
                if not col_name or col_name.lower() in emitted_cols:
                    continue
                emitted_cols.add(col_name.lower())

                # Business rule: every source column lands in BigQuery as STRING, so the
                # Power BI data type is deliberately ignored. The exception is a value the
                # derived table aggregates, which arithmetic has already made numeric.
                is_calc = _cell(col.get("is_calculated")).lower() in ("yes", "true")
                folder = _cell(col.get("display_folder"))
                kind = "" if is_calc else str(native_cols.get(col_name.lower(), {}).get("kind") or "")
                dim_type = "number" if derived_sql and kind == "aggregate" else "string"

                field = _unique_field_name(col_name, used_field_names)
                field_refs[(table_key, col_name.lower())] = field

                body.append(f"  dimension: {field} {{")
                body.append(f"    type: {dim_type}")
                body.append(f'    label: "{lookml_escape(col_name)}"')

                if col_name.lower() in table_pks:
                    body.append("    primary_key: yes")

                desc = _cell(col.get("description"))
                if desc:
                    body.append(f'    description: "{lookml_escape(desc)}"')

                if dim_type == "number":
                    vf = lookml_value_format(col.get("format_string"))
                    if vf:
                        body.append(f"    value_format_name: {vf}")

                body.append("    hidden: no")
                if folder:
                    body.append(f'    group_label: "{lookml_escape(folder)}"')
                if is_calc:
                    expr = _cell(col.get("expression"))
                    dax_lines = (expr.splitlines() or [""])[:6]
                    dax_text = _dax_literal_text(" ".join(line.strip() for line in dax_lines if line.strip()))
                    body.append("    # Calculated column in Power BI - DAX shown for reference,")
                    body.append("    # the SQL below must be reviewed before use.")
                    body.append(f'    sql: "{lookml_escape(dax_text)}" ;;')
                else:
                    body.append(f"    sql: ${{TABLE}}.{_bq_identifier(col_name)} ;;")
                body.append("  }")
                body.append("")

        # Any column named in a relationship but missing from the column list still
        # has to exist as a field, or every join referencing it fails to compile.
        missing = [c for c in sorted(join_cols.get(table_key, set())) if c.lower() not in emitted_cols]
        if missing:
            body.append("  # ---- Join keys not present in the model column list ----")
            body.append("  # Recovered from relationships so the joins compile. Check the type.")
            for col_name in missing:
                field = _unique_field_name(col_name, used_field_names)
                field_refs[(table_key, col_name.lower())] = field
                body.append(f"  dimension: {field} {{")
                body.append("    type: string")
                body.append(f'    label: "{lookml_escape(col_name)}"')
                if col_name.lower() in table_pks:
                    body.append("    primary_key: yes")
                body.append("    hidden: yes")
                body.append(f"    sql: ${{TABLE}}.{_bq_identifier(col_name)} ;;")
                body.append("  }")
                body.append("")

        # ---- Measures ----
        body.append("  # ---- Measures ----")
        count_field = _unique_field_name("count", used_field_names)
        body.append(f"  measure: {count_field} {{")
        body.append("    type: count")
        body.append('    label: "Count"')
        body.append("  }")
        body.append("")

        meas = pd.DataFrame()
        if isinstance(measures_df, pd.DataFrame) and not measures_df.empty and "table_name" in measures_df.columns:
            meas = measures_df[measures_df["table_name"].astype(str).str.strip() == table]
            if "measure_name" in meas.columns:
                meas = meas.drop_duplicates(subset=["measure_name"])

        if not meas.empty:
            body.append("  # ---- Measures carried over from Power BI (review required) ----")
            for _, m in meas.iterrows():
                m_name = _cell(m.get("measure_name"))
                if not m_name:
                    continue
                expr = _cell(m.get("expression"))
                field = _unique_field_name(m_name, used_field_names)
                body.append(f"  measure: {field} {{")
                body.append("    type: string")
                body.append(f'    label: "{lookml_escape(m_name)}"')

                desc = _cell(m.get("description"))
                if desc:
                    body.append(f'    description: "{lookml_escape(desc)}"')
                folder = _cell(m.get("display_folder"))
                if folder:
                    body.append(f'    group_label: "{lookml_escape(folder)}"')

                dax_lines = (expr.splitlines() or [""])[:12]
                dax_text = _dax_literal_text(" ".join(line.strip() for line in dax_lines if line.strip()))
                body.append(f'    sql: "{lookml_escape(dax_text)}" ;;')
                body.append("  }")
                body.append("")

        body.append("}")
        views.append({"table_name": table, "view_name": view_name, "lookml": "\n".join(body)})

    return views, field_refs


def build_lookml_explores(model_data: dict, clean_views: dict, classification: dict, field_refs: dict | None = None):
    """One explore per fact table, joining every related table."""
    relationships = clean_views.get("relationships", pd.DataFrame())
    field_refs = field_refs or {}
    explores = []

    def _ref(table: str, column: str) -> str:
        """LookML field name for a column, honouring dimension_group renaming."""
        return field_refs.get((str(table).strip().lower(), str(column).strip().lower())) or safe_model_name(column)

    for fact in classification["facts"]:
        fact_view = safe_model_name(fact)
        joins, seen = [], set()

        if isinstance(relationships, pd.DataFrame) and not relationships.empty:
            for _, rel in relationships.iterrows():
                frm = _cell(rel.get("from_table"))
                to = _cell(rel.get("to_table"))
                if frm != fact or not to or to in seen:
                    continue
                seen.add(to)

                card = (_cell(rel.get("cardinality")) or "many-to-one").lower()
                status = (_cell(rel.get("status")) or "Active").lower()
                direction = _cell(rel.get("filter_direction")) or "Single"

                from_field = _ref(frm, rel.get("from_column"))
                to_field = _ref(to, rel.get("to_column"))

                join_lines = [f"  join: {safe_model_name(to)} {{"]
                if status == "inactive":
                    join_lines.insert(0, "  # NOTE: inactive relationship in Power BI (USERELATIONSHIP only).")
                    join_lines.insert(1, "  # Commented out so it does not change results by default.")
                join_lines.append("    type:         left_outer")
                join_lines.append(f"    relationship: {LOOKML_RELATIONSHIP_MAP.get(card, 'many_to_one')}")
                join_lines.append(
                    f"    sql_on:       ${{{fact_view}.{from_field}}} = ${{{safe_model_name(to)}.{to_field}}} ;;"
                )
                join_lines.append(f'    view_label:   "{lookml_escape(lookml_label(to))}"')
                if direction.lower() == "both":
                    join_lines.append("    # Power BI uses bidirectional cross-filtering here. Looker has no")
                    join_lines.append("    # equivalent - if a dimension needs to filter the fact, model it")
                    join_lines.append("    # explicitly rather than expecting it to propagate.")
                join_lines.append("  }")

                # Inactive relationships are emitted but commented out - they only apply
                # inside USERELATIONSHIP() in DAX, so enabling them here would silently
                # change every number in the explore. The NOTE lines above are already
                # comments, hence the startswith check.
                if status == "inactive":
                    joins.append("\n".join(
                        f"# {line}" if line.strip() and not line.strip().startswith("#") else line
                        for line in join_lines
                    ))
                else:
                    joins.append("\n".join(join_lines))

        body = [
            f"explore: {fact_view} {{",
            f'  label:       "{lookml_escape(lookml_label(fact))}"',
            (f'  description: "Generated from the Power BI table {lookml_escape(fact)}. '
             f'{len(joins)} related table(s) joined."'),
            # Fan-out protection. Without this a sum on the fact is multiplied by the
            # number of matching rows on any one-to-many join.
            "  symmetric_aggregates: yes",
            "",
        ]
        body.extend(f"{j}\n" for j in joins)
        body.append("}")
        explores.append({"table_name": fact, "explore_name": fact_view, "join_count": len(joins), "lookml": "\n".join(body)})

    return explores


def build_lookml_model(
    pbip_path: Path,
    model_data: dict,
    clean_views: dict,
    connection_name: str = "dev-dna-dataforge-finance-dataset",
    include_views: bool = False,
):
    """Assemble the .model.lkml text.

    By default the views are NOT inlined - they are returned alongside the text so the
    caller can write one <name>.view.lkml per view. Pass include_views=True to get the
    old single-file behaviour (everything in one .lkml).
    """
    classification = classify_model_tables(model_data.get("model_tables", pd.DataFrame()), clean_views.get("relationships", pd.DataFrame()))
    # Views first - they decide the final field names, which the joins must match.
    views, field_refs = build_lookml_views(model_data, clean_views)
    explores = build_lookml_explores(model_data, clean_views, classification, field_refs)

    model_name = safe_model_name(pbip_path.stem)
    generated = datetime.datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")

    header = lookml_comment_block(
        [
            "=" * 58,
            f"MODEL: {model_name}",
            f"Source: {pbip_path.name}",
            f"Generated: {generated} by {get_current_user()}",
            f"Tool: PowerBI Documentation Studio v{APP_VERSION}",
            "",
            "AUTO-GENERATED from a Power BI PBIP project.",
            "Review before deploying - DAX measures are emitted as comments",
            "and must be rewritten as SQL.",
            "",
            "CONTENTS",
            "-" * 58,
            f"  Explores (fact tables) : {len(explores)}",
            f"  Views (all tables)     : {len(views)}",
            f"  Dimension tables       : {len(classification['dimensions'])}",
            f"  Parameter tables       : {len(classification['parameters'])}",
            "",
            "EXPLORES",
            "-" * 58,
        ]
        + [f"  {e['explore_name']:<32} {e['join_count']} join(s)" for e in explores]
        + ["=" * 58]
    )

    parts = [
        header,
        "",
        f'connection: "{connection_name}"',
        "",
        f'include: "/lookml/finance/{model_name}/views/*.view.lkml"',
        "",
    ]

    if explores:
        parts.append(lookml_comment_block(["=" * 58, "EXPLORES", "=" * 58]))
        parts.append("")
        for e in explores:
            parts.append(e["lookml"])
            parts.append("")
    else:
        parts.append("# No fact tables detected - no explores generated.")
        parts.append("")

    if include_views:
        parts.append(lookml_comment_block(["=" * 58, "VIEWS", "Move each block into /views/<name>.view.lkml", "=" * 58]))
        parts.append("")
        for v in views:
            parts.append(v["lookml"])
            parts.append("")
    else:
        parts.append(
            lookml_comment_block(
                [
                    "=" * 58,
                    "VIEWS",
                    f"{len(views)} view(s) written to ./views/<name>.view.lkml",
                    "and picked up by the include statement above.",
                    "=" * 58,
                ]
            )
        )
        parts.append("")

    return "\n".join(parts), {"explores": len(explores), "views": len(views)}, views
