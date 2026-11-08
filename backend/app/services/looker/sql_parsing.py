"""Native SQL parsing helpers.

Ported verbatim from the source tool. Power BI only keeps the *alias*
of every column in the semantic model, so the model says `CHNL_ID`
while the warehouse table has no such column - the value is produced
by a CASE expression inside the native SQL of the table's partition.
These helpers read the SELECT list of the native SQL back out and map
each alias to the expression that actually produced it.
"""
import re

import pandas as pd

from app.services.looker.text_utils import extract_sql_fragment

# Words that may appear bare inside an expression and are not column references.
_SQL_NON_COLUMN_WORDS = {
    "all", "and", "any", "array", "as", "asc", "between", "bigint", "binary", "boolean", "by", "case", "cast",
    "char", "character", "collate", "current", "date", "datetime", "day", "dayofweek", "dayofyear", "dec",
    "decimal", "desc", "distinct", "div", "double", "else", "end", "escape", "except", "exists", "false",
    "float", "following", "for", "from", "geography", "geometry", "group", "hour", "ilike", "in", "int",
    "integer", "intersect", "interval", "is", "like", "microsecond", "millisecond", "minute", "mod", "month",
    "nanosecond", "not", "nulls", "null", "number", "numeric", "object", "of", "or", "order", "over",
    "partition", "precision", "preceding", "quarter", "range", "real", "regexp", "rlike", "row", "rows",
    "second", "select", "smallint", "some", "string", "text", "then", "time", "timestamp", "timestamp_ltz",
    "timestamp_ntz", "timestamp_tz", "tinyint", "true", "unbounded", "union", "using", "variant", "varchar",
    "week", "weekday", "when", "where", "with", "within", "year",
}

# A trailing bare word from this set closes an expression - it is never an alias.
_SQL_NOT_AN_ALIAS = {
    "all", "and", "asc", "between", "desc", "distinct", "else", "end", "escape", "exists", "false", "in",
    "is", "like", "not", "null", "or", "then", "true", "when",
}

_SQL_AGGREGATE_REGEX = re.compile(
    r"\b(sum|avg|count|count_if|min|max|median|mode|stddev\w*|var\w*|variance\w*|listagg|string_agg|array_agg"
    r"|object_agg|any_value|approx_count_distinct|approx_percentile|percentile\w*|corr|covar\w*|grouping"
    r"|bitand_agg|bitor_agg|bitxor_agg|booland_agg|boolor_agg|boolxor_agg|hll\w*|kurtosis|skew)\s*\(",
    re.IGNORECASE,
)

_SQL_IDENT_CHAIN = re.compile(r"^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)*$")
_SQL_QUOTED_IDENT = re.compile(r'^"(?:[^"]|"")*"$')
_SQL_SEGMENT_REGEX = re.compile(r'"(?:[^"]|"")*"|[A-Za-z_][\w$]*')
_SQL_TOKEN_REGEX = re.compile(
    r"('(?:[^']|'')*')"                                        # string literal
    r"|(\"(?:[^\"]|\"\")*\"(?:\s*\.\s*\"(?:[^\"]|\"\")*\")*)"  # quoted identifier chain
    r"|([A-Za-z_][\w$]*(?:\s*\.\s*[A-Za-z_][\w$]*)*)"          # bare identifier chain
)


def _sql_strip_comments(text: str) -> str:
    """Drop -- and /* */ comments without touching quoted text."""
    out, i, n, quote = [], 0, len(text), ""
    while i < n:
        ch = text[i]
        if quote:
            out.append(ch)
            if ch == quote:
                if i + 1 < n and text[i + 1] == quote:
                    out.append(text[i + 1])
                    i += 2
                    continue
                quote = ""
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            out.append(ch)
            i += 1
            continue
        if text.startswith("--", i):
            nl = text.find("\n", i)
            i = n if nl < 0 else nl
            continue
        if text.startswith("/*", i):
            close = text.find("*/", i + 2)
            i = n if close < 0 else close + 2
            out.append(" ")
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _sql_depth_map(text: str):
    """Per-character bracket depth and 'inside quotes' flags."""
    depths = [0] * len(text)
    quoted = [False] * len(text)
    depth, quote, i, n = 0, "", 0, len(text)
    while i < n:
        ch = text[i]
        if quote:
            quoted[i] = True
            depths[i] = depth
            if ch == quote:
                if i + 1 < n and text[i + 1] == quote:
                    quoted[i + 1] = True
                    depths[i + 1] = depth
                    i += 2
                    continue
                quote = ""
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            quoted[i] = True
            depths[i] = depth
            i += 1
            continue
        if ch == "(":
            depths[i] = depth
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
            depths[i] = depth
        else:
            depths[i] = depth
        i += 1
    return depths, quoted


def _sql_select_span(text: str):
    """(select list start, select list end, index after the matching FROM), or None.

    Works on comment-stripped text and returns offsets rather than slices so callers
    can rewrite the select list in place.
    """
    if not text.strip():
        return None
    depths, quoted = _sql_depth_map(text)

    # The final SELECT at depth 0 is the one that names the output columns, so CTEs
    # and sub-queries are skipped. A depth-0 set operator stops the walk because the
    # column names of a UNION come from its first branch.
    select_pos = -1
    for m in re.finditer(r"\b(select|union|intersect|minus)\b", text, flags=re.IGNORECASE):
        i = m.start()
        if quoted[i] or depths[i] != 0:
            continue
        if m.group(1).lower() != "select":
            break
        select_pos = i
    if select_pos < 0:
        return None

    start = select_pos + len("select")
    for pattern in (r"\s*(?:distinct|all)\b", r"\s*top\s+\d+\b"):
        m = re.match(pattern, text[start:], flags=re.IGNORECASE)
        if m:
            start += m.end()

    end = tail = len(text)
    for m in re.finditer(r"\bfrom\b", text, flags=re.IGNORECASE):
        i = m.start()
        if i > start and not quoted[i] and depths[i] == 0:
            end, tail = i, m.end()
            break
    return start, end, tail


def _sql_split_query(sql_text: str):
    """Return (text between the outermost SELECT and its FROM, text after that FROM)."""
    text = _sql_strip_comments(str(sql_text or ""))
    span = _sql_select_span(text)
    if span is None:
        return "", ""
    start, end, tail = span
    return text[start:end], text[tail:]


def _sql_cte_bodies(sql_text: str):
    """Return {cte name (lower): body} for the WITH clause of a query."""
    text = _sql_strip_comments(str(sql_text or ""))
    if not text.strip():
        return {}
    depths, quoted = _sql_depth_map(text)
    bodies = {}
    for m in re.finditer(r"\b([A-Za-z_][\w$]*)\s+as\s*\(", text, flags=re.IGNORECASE):
        open_idx = m.end() - 1
        if quoted[m.start()] or depths[open_idx] != 0:
            continue  # nested CTE or a CAST(... AS ...) inside an expression
        depth, i = 1, open_idx + 1
        while i < len(text) and depth:
            if not quoted[i]:
                if text[i] == "(":
                    depth += 1
                elif text[i] == ")":
                    depth -= 1
            i += 1
        bodies.setdefault(m.group(1).lower(), text[open_idx + 1: i - 1])
    return bodies


def _sql_split_items(select_list: str):
    """Split a SELECT list on its top-level commas."""
    depths, quoted = _sql_depth_map(select_list)
    items, start = [], 0
    for i, ch in enumerate(select_list):
        if ch == "," and depths[i] == 0 and not quoted[i]:
            items.append(select_list[start:i])
            start = i + 1
    items.append(select_list[start:])
    return [it.strip() for it in items if it.strip()]


def _sql_split_alias(item: str):
    """Split one SELECT item into (expression, alias)."""
    expr = item.strip()
    if not expr:
        return "", ""

    m = re.search(r'"((?:[^"]|"")*)"\s*$', expr)
    if m and m.start() > 0:
        head = re.sub(r"\bas\s*$", "", expr[: m.start()].rstrip(), flags=re.IGNORECASE).rstrip()
        if head:
            return head, m.group(1).replace('""', '"')

    m = re.search(r"\bas\s+([A-Za-z_][\w$]*)\s*$", expr, flags=re.IGNORECASE)
    if m and expr[: m.start()].strip():
        return expr[: m.start()].rstrip(), m.group(1)

    # Alias with no AS keyword: `<expression> <name>`. Guarded so the right-hand
    # operand of `a + b` is not mistaken for an alias.
    m = re.search(r"\S\s+([A-Za-z_][\w$]*)\s*$", expr)
    if m:
        alias = m.group(1)
        head = expr[: m.start(1)].rstrip()
        if head and alias.lower() not in _SQL_NOT_AN_ALIAS and head[-1] not in "+-*/%|&^=<>~!,(":
            return head, alias

    return expr, ""


def _sql_last_segment(expr: str) -> str:
    segments = _SQL_SEGMENT_REGEX.findall(expr.strip())
    return segments[-1] if segments else ""


def _sql_requalify(expr: str):
    """Rewrite `alias.col` / `col` references as `${TABLE}.col`.

    Also returns the distinct table qualifiers seen. More than one means the expression
    spans a join, and collapsing them all onto `${TABLE}` would quietly change the logic
    (`wk.seq = cal.seq` would become `seq = seq`), so the caller must not trust it.
    """
    pieces, qualifiers, pos = [], set(), 0
    for m in _SQL_TOKEN_REGEX.finditer(expr):
        pieces.append(expr[pos: m.start()])
        pos = m.end()
        literal, quoted_ident, bare_ident = m.group(1), m.group(2), m.group(3)
        if literal:
            pieces.append(literal)
            continue
        token = quoted_ident or bare_ident
        if expr[m.end():].lstrip()[:1] == "(":
            pieces.append(token)  # function name
            continue
        if bare_ident and bare_ident.split(".")[-1].strip().lower() in _SQL_NON_COLUMN_WORDS:
            pieces.append(token)
            continue
        segments = _SQL_SEGMENT_REGEX.findall(token)
        if len(segments) > 1:
            qualifiers.add(segments[-2].strip('"').lower())
        pieces.append("${TABLE}." + (segments[-1] if segments else token))
    pieces.append(expr[pos:])
    return "".join(pieces), qualifiers


def parse_native_sql_columns(sql_text: str, _depth: int = 0, _ctes: dict | None = None):
    """Map every output alias of a native SQL query to how it is produced.

    Returns {alias_lower: {"kind", "expression", "source_column", "sql"}} where kind is
    `column` (a plain source column, possibly renamed), `expression` (row-level logic
    such as CASE/NVL/CONCAT) or `aggregate` (SUM/COUNT/... - not valid in a dimension).
    A bare `SELECT *` returns nothing, which is correct: those columns reach the model
    unchanged, so the plain `${TABLE}.<column>` fallback already describes them.
    """
    select_list, from_tail = _sql_split_query(sql_text)
    if not select_list.strip():
        return {}

    items = _sql_split_items(select_list)
    if not items:
        return {}

    # `SELECT * FROM <cte>` only forwards another query's columns, so follow it to the
    # query that actually names them. Bounded, and it keeps working for nested CTEs.
    ctes = dict(_ctes or {})
    ctes.update(_sql_cte_bodies(sql_text))
    if all(item == "*" or item.endswith(".*") for item in items):
        target = re.match(r"\s*([A-Za-z_][\w$]*)", from_tail)
        body = ctes.get(target.group(1).lower()) if target else None
        if body and _depth < 3:
            return parse_native_sql_columns(body, _depth + 1, ctes)
        return {}

    parsed = {}
    for item in items:
        expr, alias = _sql_split_alias(item)
        expr = " ".join(str(expr).split())
        if not expr or expr == "*" or expr.endswith(".*"):
            continue
        if not alias:
            if _SQL_IDENT_CHAIN.match(expr) or _SQL_QUOTED_IDENT.match(expr):
                alias = _sql_last_segment(expr).strip('"')
            if not alias:
                continue
        key = alias.strip().lower()
        if not key or key in parsed:
            continue

        if _SQL_IDENT_CHAIN.match(expr) or _SQL_QUOTED_IDENT.match(expr):
            segment = _sql_last_segment(expr)
            parsed[key] = {
                "kind": "column",
                "expression": expr,
                "source_column": segment.strip('"'),
                "sql": "${TABLE}." + segment,
                "safe": True,
            }
            continue

        rewritten, qualifiers = _sql_requalify(expr)
        parsed[key] = {
            "kind": "aggregate" if _SQL_AGGREGATE_REGEX.search(expr) else "expression",
            "expression": expr,
            "source_column": alias,
            "sql": rewritten,
            "safe": len(qualifiers) < 2,
        }
    return parsed


_M_RENAME_CALL_REGEX = re.compile(r"Table\.RenameColumns\s*\(", re.IGNORECASE)
_M_RENAME_PAIR_REGEX = re.compile(r'\{\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*\}')


def _m_column_rename_map(m_text: str):
    """Power Query `Table.RenameColumns` steps -> {final name (lower): name the SQL produced}.

    Renaming happens in M *after* the native query has run, so the model's column name is
    frequently not the SQL alias at all - `PRIM_LOC` in the model is `LOC_ID` in the SQL.
    Chained renames are followed back to the name the warehouse actually returned.
    """
    text = str(m_text or "")
    origin = {}
    for call in _M_RENAME_CALL_REGEX.finditer(text):
        # Walk to the matching bracket so only this step's pairs are read - other steps
        # (Table.ReplaceValue, Table.TransformColumnTypes) use the same brace syntax.
        start = call.end()
        depth, end = 1, start
        while end < len(text) and depth:
            if text[end] == "(":
                depth += 1
            elif text[end] == ")":
                depth -= 1
            end += 1
        for old, new in _M_RENAME_PAIR_REGEX.findall(text[start:end]):
            old, new = old.replace('""', '"').strip(), new.replace('""', '"').strip()
            if old and new:
                origin[new.lower()] = origin.pop(old.lower(), old)
    return origin


def _collect_native_sql(model_data: dict, clean_views: dict):
    """table name (lower) -> {"sql": the report's query, "m": its Power Query text}.

    `model_queries` is read first because its native SQL is extracted before the M text
    is truncated for storage, so it is the only complete copy of a long query. Partitions
    and the cleaned query view follow; the latter is the only source on the merge path.
    """
    collected = {}

    def _slot(name):
        key = str(name or "").strip().lower()
        return collected.setdefault(key, {"sql": "", "m": ""}) if key else None

    def _as_sql(text):
        text = str(text or "").strip()
        if not text:
            return ""
        native = extract_sql_fragment(text)
        if native:
            return native
        return text if re.match(r"^\s*(with|select)\b", text, flags=re.IGNORECASE) else ""

    queries = model_data.get("model_queries", pd.DataFrame())
    if isinstance(queries, pd.DataFrame) and not queries.empty and "query_name" in queries.columns:
        for _, row in queries.iterrows():
            slot = _slot(row.get("query_name"))
            if slot is not None:
                m_text = str(row.get("m_query_clean") or "")
                slot["sql"] = slot["sql"] or str(row.get("native_sql_clean") or "").strip() or _as_sql(m_text)
                slot["m"] = slot["m"] or m_text

    partitions = model_data.get("model_partitions", pd.DataFrame())
    if isinstance(partitions, pd.DataFrame) and not partitions.empty and "table_name" in partitions.columns:
        for _, row in partitions.iterrows():
            slot = _slot(row.get("table_name"))
            if slot is not None:
                m_text = str(row.get("expression_or_query") or "")
                slot["sql"] = slot["sql"] or _as_sql(m_text)
                slot["m"] = slot["m"] or m_text

    used = clean_views.get("queries_used", pd.DataFrame())
    if isinstance(used, pd.DataFrame) and not used.empty and "query_name" in used.columns:
        for _, row in used.iterrows():
            slot = _slot(row.get("query_name"))
            if slot is not None:
                slot["sql"] = slot["sql"] or _as_sql(row.get("query_text"))

    return collected


def build_native_sql_column_map(model_data: dict, clean_views: dict):
    """table name (lower) -> {model column (lower): how the warehouse really produces it}."""
    mapping = {}
    for key, blob in _collect_native_sql(model_data, clean_views).items():
        fields = parse_native_sql_columns(blob["sql"])
        for final_name, original in _m_column_rename_map(blob["m"]).items():
            entry = fields.get(original.lower())
            if entry is None:
                # Renamed straight off a `SELECT *`, so the pre-rename name is the warehouse
                # column. Names that are not plain identifiers were built in M, not in SQL.
                if not _SQL_IDENT_CHAIN.match(original):
                    continue
                entry = {"kind": "column", "expression": original, "source_column": original,
                         "sql": "${TABLE}." + original, "safe": True}
            fields[final_name] = entry
        if fields:
            mapping[key] = fields
    return mapping
