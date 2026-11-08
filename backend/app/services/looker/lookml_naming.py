"""LookML naming/formatting helpers.

Ported verbatim from the source tool.
"""
import re

import pandas as pd

from app.services.looker.tmdl_parser import _tmdl_unquote

LOOKML_RULE = "# " + "-" * 58

# ------- TMDL/Power BI data types -> LookML dimension types.
LOOKML_TYPE_MAP = {
    "string": "string",
    "int64": "number",
    "double": "number",
    "decimal": "number",
    "boolean": "yesno",
    "datetime": "time",
    "date": "time",
}

# Power BI cardinality -> LookML join relationship (from the *explore's* view).
LOOKML_RELATIONSHIP_MAP = {
    "many-to-one": "many_to_one",
    "one-to-many": "one_to_many",
    "one-to-one": "one_to_one",
    "many-to-many": "many_to_many",
}


def safe_model_name(value: str) -> str:
    """Convert a Power BI object name into a safe snake_case LookML identifier."""
    text = _tmdl_unquote(str(value or "")).strip()
    text = re.sub(r"[^\w]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_").lower()
    if not text:
        return "unnamed"
    if text[0].isdigit():
        text = f"f_{text}"
    return text


def lookml_label(value: str) -> str:
    """Human-friendly label, e.g. Dim_xrf_loc_fin -> 'Dim Xrf Loc Fin'."""
    text = _tmdl_unquote(str(value or "")).strip()
    text = re.sub(r"[_\s]+", " ", text).strip()
    return text.title() if text.islower() or text.isupper() else text


def lookml_escape(value: str) -> str:
    """Escape a string for a double-quoted LookML value."""
    text = str(value or "")
    text = text.replace("\\", "\\\\").replace('"', '\\"')
    text = re.sub(r"\s*\n\s*", " ", text)
    return text.strip()


def lookml_comment_block(lines) -> str:
    return "\n".join(f"# {line}".rstrip() for line in lines)


def _dax_literal_text(dax_text: str) -> str:
    """Unwrap a DAX expression that is nothing but one double-quoted string constant.

    DAX escapes an embedded quote by doubling it (`""`), the same convention SQL uses.
    Without this, a DAX measure such as `"https://example.com"` becomes the confusing
    `sql: "\"https://example.com\""` once the outer LookML quoting is added; unwrapping
    it first gives the plain `sql: "https://example.com"`.
    """
    m = re.fullmatch(r'"((?:[^"]|"")*)"', dax_text.strip())
    return dax_text if m is None else m.group(1).replace('""', '"')


def _lookml_dimension_type(data_type: str) -> str:
    return LOOKML_TYPE_MAP.get(str(data_type or "").strip().lower(), "string")


def _cell(value) -> str:
    """Row value as clean text. Guards against pandas NaN, which is truthy and
    would otherwise stringify to the literal "nan" in the generated LookML."""
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    text = str(value).strip()
    return "" if text.lower() in ("nan", "none", "nat") else text


# A bare SQL identifier. Anything else has to be quoted or the generated SQL
# will not parse - Power BI names routinely contain spaces, '%' and '#'.
_BARE_SQL_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")

# Reserved words that must be quoted even though they look bare.
_SQL_RESERVED = {
    "select", "from", "where", "group", "order", "by", "join", "left", "right",
    "inner", "outer", "on", "as", "and", "or", "not", "null", "case", "when",
    "then", "else", "end", "table", "column", "value", "values", "date", "time",
    "timestamp", "user", "current", "default", "start", "row", "rows",
    "like", "in", "is", "all", "any", "between", "union", "with", "into",
}


def sql_identifier(name: str) -> str:
    """Quote a column/table name for SQL when it is not a bare identifier.

    Double quotes are the ANSI form and are what Snowflake expects. Quoting also
    makes the name case-sensitive in Snowflake, so we only do it when we have to.
    """
    text = _tmdl_unquote(str(name or "")).strip()
    if not text:
        return text
    if _BARE_SQL_IDENT.match(text) and text.lower() not in _SQL_RESERVED:
        return text
    return '"' + text.replace('"', '""') + '"'


def sql_table_reference(name: str) -> str:
    """Quote each part of a possibly dotted table reference (db.schema.table)."""
    text = _tmdl_unquote(str(name or "")).strip()
    if not text:
        return text
    return ".".join(sql_identifier(part) for part in text.split(".") if part.strip())


# Trailing tokens stripped from a dimension_group name. Looker appends the
# timeframe itself, so a column called ORDER_DATE must become `order` or every
# reference reads `order_date_date`.
_DATE_SUFFIXES = ("_date", "_dt", "_datetime", "_timestamp", "_ts", "_time", "_day")


def dimension_group_name(column_name: str) -> str:
    """LookML dimension_group base name, with any trailing date token removed."""
    base = safe_model_name(column_name)
    for suffix in _DATE_SUFFIXES:
        if base.endswith(suffix) and len(base) > len(suffix):
            return base[: -len(suffix)]
    return base


# Power BI format strings -> Looker value_format_name. Only the unambiguous
# ones; anything else keeps the raw format string as a comment instead.
def lookml_value_format(format_string: str) -> str:
    fmt = str(format_string or "").strip()
    if not fmt:
        return ""
    low = fmt.lower()
    if "%" in fmt:
        return "percent_2" if "0.00" in fmt or "#,##0.00" in fmt else "percent_0"
    if "$" in fmt or "currency" in low:
        return "usd" if "0.00" in fmt else "usd_0"
    if fmt in ("0", "#,##0"):
        return "decimal_0"
    if fmt in ("0.0", "#,##0.0"):
        return "decimal_1"
    if fmt in ("0.00", "#,##0.00"):
        return "decimal_2"
    return ""


def _relationship_key_columns(relationships_df: pd.DataFrame):
    """Columns used on each side of a join, plus the inferred primary keys.

    Returns (join_columns, primary_keys) keyed by lowercased table name. The
    'one' side of a Power BI relationship is by definition unique, so its column
    is the natural primary key - Looker needs that declared or symmetric
    aggregates cannot protect against fan-out.
    """
    join_cols, pks = {}, {}
    if not isinstance(relationships_df, pd.DataFrame) or relationships_df.empty:
        return join_cols, pks

    for _, rel in relationships_df.iterrows():
        frm = _cell(rel.get("from_table"))
        to = _cell(rel.get("to_table"))
        fcol = _cell(rel.get("from_column"))
        tcol = _cell(rel.get("to_column"))
        if frm and fcol:
            join_cols.setdefault(frm.lower(), set()).add(fcol)
        if to and tcol:
            join_cols.setdefault(to.lower(), set()).add(tcol)
            # 'to' is the one-side, so this column is unique within that table.
            pks.setdefault(to.lower(), set()).add(tcol)
    return join_cols, pks
