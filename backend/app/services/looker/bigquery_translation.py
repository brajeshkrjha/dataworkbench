"""Snowflake -> BigQuery SQL translation and pretty-printing.

Ported verbatim from the source tool.
"""
import re

from app.services.looker.sql_parsing import (
    _SQL_IDENT_CHAIN,
    _SQL_NON_COLUMN_WORDS,
    _SQL_QUOTED_IDENT,
    _sql_depth_map,
    _sql_last_segment,
    _sql_select_span,
    _sql_split_alias,
    _sql_split_items,
    _sql_strip_comments,
)

# BigQuery has no database level, so `db.schema.table` collapses onto one dataset.
BIGQUERY_DATASET = "finance_silver_omm"

# Every column lands in BigQuery as STRING, so numeric use needs an explicit CAST.
_BQ_NUMERIC_AGGREGATES = {"sum", "avg", "median", "stddev", "stddev_pop", "stddev_samp",
                          "var_pop", "var_samp", "variance"}

# Snowflake names that BigQuery spells differently but calls the same way.
_BQ_FUNCTION_RENAMES = {"nvl": "IFNULL", "iff": "IF", "listagg": "STRING_AGG",
                        "len": "LENGTH", "to_varchar": "CAST_TO_STRING"}

_BQ_NUMBER_LITERAL = re.compile(r"^-?\d+(\.\d+)?$")
_BQ_COLUMN_REF = r"[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*"

# Snowflake type names, and the BigQuery type each one becomes inside a CAST.
_BQ_TYPE_NAMES = {
    "number": "NUMERIC", "decimal": "NUMERIC", "numeric": "NUMERIC",
    "int": "INT64", "integer": "INT64", "bigint": "INT64", "smallint": "INT64", "tinyint": "INT64",
    "float": "FLOAT64", "float8": "FLOAT64", "double": "FLOAT64", "real": "FLOAT64",
    "varchar": "STRING", "char": "STRING", "character": "STRING", "text": "STRING",
    "boolean": "BOOL", "timestamp_ntz": "DATETIME", "timestamp_ltz": "TIMESTAMP",
    "timestamp_tz": "TIMESTAMP", "variant": "STRING",
}


def _bq_identifier(name: str) -> str:
    """Quote a name that is not a bare BigQuery identifier, e.g. `Region#`."""
    name = str(name or "")
    return name if re.match(r"^[A-Za-z_]\w*$", name) else f"`{name}`"


def _bq_cast(expr: str, target: str) -> str:
    """Wrap a reference in CAST unless it plainly does not need one."""
    text = str(expr or "").strip()
    if not text or _BQ_NUMBER_LITERAL.match(text) or re.match(r"(?i)^(safe_)?cast\s*\(", text):
        return text
    if text.lower() in _SQL_NON_COLUMN_WORDS:
        return text
    return f"CAST({text} AS {target})"


def _sql_call_spans(text: str, names):
    """(name, start, open paren, close paren) for every call of the named functions."""
    depths, quoted = _sql_depth_map(text)
    spans = []
    for m in re.finditer(r"\b([A-Za-z_][\w$]*)\s*\(", text):
        if quoted[m.start()] or m.group(1).lower() not in names:
            continue
        open_idx = m.end() - 1
        depth = depths[open_idx]
        close = next((i for i in range(open_idx + 1, len(text))
                      if text[i] == ")" and not quoted[i] and depths[i] == depth), None)
        if close is not None:
            spans.append((m.group(1), m.start(), open_idx, close))
    return spans


def _bq_table_references(text: str) -> str:
    """`db.schema.table` -> `` `dataset.table` ``. Undotted CTE names are left alone.

    Snowflake exports quote the parts (`"DB"."SCHEMA"."TABLE"`) about half the time, so
    both spellings are matched and only the table part survives - BigQuery has no third level.
    """
    segment = r'(?:"[^"]+"|[A-Za-z_][\w$]*)'

    def repl(m):
        parts = re.findall(r'"[^"]+"|[A-Za-z_][\w$]*', m.group(2))
        table = parts[-1].strip('"').lower()
        return f"{m.group(1)} `{BIGQUERY_DATASET}.{table}`"

    return re.sub(rf"\b(from|join)\s+({segment}(?:\s*\.\s*{segment})+)", repl, text, flags=re.IGNORECASE)


def _bq_substring_search(text: str) -> str:
    """`POSITION(needle, haystack)` -> `STRPOS(haystack, needle)`.

    BigQuery takes these arguments the opposite way round from Snowflake. Renaming without
    swapping them returns 0 instead of the offset, which fails silently, so it is done here
    rather than through the plain rename table.
    """
    for _, start, open_idx, close_idx in reversed(_sql_call_spans(text, {"position", "charindex"})):
        args = _sql_split_items(text[open_idx + 1: close_idx])
        if len(args) != 2:
            continue
        text = f"{text[:start]}STRPOS({args[1].strip()}, {args[0].strip()}){text[close_idx + 1:]}"
    return text


def _bq_cast_types(text: str) -> str:
    """`TRY_CAST(x AS INTEGER)` -> `SAFE_CAST(x AS INT64)`.

    Any length specification (`VARCHAR(10)`) is dropped, since BigQuery types carry none.
    Only a type sitting immediately before the closing bracket is touched, so a column
    aliased `AS text` in a select list is left alone.
    """
    text = re.sub(r"(?i)\btry_cast(\s*\()", r"SAFE_CAST\1", text)
    names = "|".join(sorted(_BQ_TYPE_NAMES, key=len, reverse=True))
    return re.sub(
        r"(?i)(\bas\s+)(" + names + r")\b\s*(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(?=\s*\))",
        lambda m: m.group(1) + _BQ_TYPE_NAMES[m.group(2).lower()], text)


def _bq_collate(text: str) -> str:
    """Snowflake's `COLLATE(x, '')` is a no-op wrapper that BigQuery has no function for.

    Only the empty specification is unwrapped, because that alone is guaranteed to mean
    "leave the value alone". A real collation is left in place for someone to look at.
    """
    for _, start, open_idx, close_idx in reversed(_sql_call_spans(text, {"collate"})):
        args = _sql_split_items(text[open_idx + 1: close_idx])
        if len(args) == 2 and args[1].strip() in ("''", '""'):
            text = text[:start] + args[0].strip() + text[close_idx + 1:]
    return text


def _bq_function_names(text: str) -> str:
    """Rename the Snowflake functions BigQuery calls the same way but spells differently."""
    text = re.sub(r"\b(" + "|".join(_BQ_FUNCTION_RENAMES) + r")(\s*\()",
                  lambda m: _BQ_FUNCTION_RENAMES[m.group(1).lower()] + m.group(2), text, flags=re.IGNORECASE)
    # TO_VARCHAR(x) is a cast, not a function, so it needs the argument moving.
    for _, start, open_idx, close_idx in reversed(_sql_call_spans(text, {"cast_to_string"})):
        text = f"{text[:start]}CAST({text[open_idx + 1:close_idx].strip()} AS STRING){text[close_idx + 1:]}"
    return text


def _bq_scaled_rounding(text: str) -> str:
    """`FLOOR(x, 3)` has no BigQuery equivalent, so scale it by hand."""
    for name, start, open_idx, close_idx in reversed(_sql_call_spans(text, {"floor", "ceil", "ceiling"})):
        args = _sql_split_items(text[open_idx + 1: close_idx])
        if len(args) != 2 or not re.match(r"^\d+$", args[1].strip()):
            continue
        factor = 10 ** int(args[1])
        keyword = "FLOOR" if name.lower() == "floor" else "CEIL"
        text = f"{text[:start]}{keyword}({args[0].strip()} * {factor}) / {factor}{text[close_idx + 1:]}"
    return text


def _bq_cast_aggregates(text: str) -> str:
    """A STRING column cannot be summed, so cast the aggregated column."""
    for _, _, open_idx, close_idx in reversed(_sql_call_spans(text, _BQ_NUMERIC_AGGREGATES)):
        inner = text[open_idx + 1: close_idx].strip()
        m = re.match(r"(?i)^(distinct\s+)(.*)$", inner, flags=re.DOTALL)
        prefix, body = (m.group(1), m.group(2).strip()) if m else ("", inner)
        # Only a bare column is rewritten here; anything richer is handled by the
        # arithmetic and comparison passes that look inside the expression.
        if _SQL_IDENT_CHAIN.match(body):
            text = f"{text[:open_idx + 1]}{prefix}{_bq_cast(body, 'FLOAT64')}{text[close_idx:]}"
    return text


def _bq_current_date(text: str) -> str:
    """`CURRENT_DATE() - 1` -> `DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)`."""
    return re.sub(
        r"(?i)\bcurrent_date\b\s*(?:\(\s*\))?\s*([-+])\s*(\d+)",
        lambda m: "DATE_{}(CURRENT_DATE(), INTERVAL {} DAY)".format(
            "SUB" if m.group(1) == "-" else "ADD", m.group(2)),
        text)


def _bq_date_to_string(text: str) -> str:
    """A date expression compared with a landed column has to match its STRING type."""
    date_call = r"DATE_(?:SUB|ADD)\((?:[^()]|\([^()]*\))*\)"
    # `= (DATE_SUB(...))` first loses the redundant brackets so the cast can wrap the call.
    text = re.sub(r"\(\s*(" + date_call + r")\s*\)", r"\1", text)
    return re.sub(
        r"(?i)(" + _BQ_COLUMN_REF + r")(\s*=\s*)(" + date_call + r")",
        lambda m: f"{m.group(1)}{m.group(2)}CAST({m.group(3)} AS STRING)", text)


def _bq_cast_arithmetic(text: str) -> str:
    """A STRING column will not add, so cast columns used in arithmetic."""
    # `(col) - 1` first loses its redundant brackets so the column is adjacent to the operator.
    text = re.sub(r"\(\s*(" + _BQ_COLUMN_REF + r")\s*\)(\s*[-+*/]\s*-?\d)", r"\1\2", text)
    return re.sub(
        r"(?<![\w.`])(" + _BQ_COLUMN_REF + r")(\s*[-+*/]\s*)(-?\d+(?:\.\d+)?)(?![\w.])",
        lambda m: (f"{m.group(1)}{m.group(2)}{m.group(3)}"
                   if m.group(1).split(".")[-1].lower() in _SQL_NON_COLUMN_WORDS
                   else f"{_bq_cast(m.group(1), 'INT64')}{m.group(2)}{m.group(3)}"),
        text)


def _bq_comparison_target(text: str, idx: int, depths, quoted) -> str:
    """The numeric type a comparison forces on its left side, or "" to leave it alone."""
    rest = text[idx:]
    literal = re.match(r"-?\d+(\.\d+)?(?![\w.])", rest)
    if literal:
        return "FLOAT64" if "." in literal.group(0) else "INT64"
    if not rest.startswith("("):
        return ""
    depth = depths[idx]
    close = next((i for i in range(idx + 1, len(text))
                  if text[i] == ")" and not quoted[i] and depths[i] == depth), None)
    if close is None:
        return ""
    inner = text[idx + 1: close].strip()
    if re.match(r"(?i)^select\b", inner):
        # A sub-query only forces a cast if its own projection was already made numeric.
        return "INT64" if re.search(r"(?i)\bas\s+(int64|float64|numeric)\b", inner) else ""
    items = _sql_split_items(inner)
    if items and all(_BQ_NUMBER_LITERAL.match(i.strip()) for i in items):
        return "FLOAT64" if any("." in i for i in items) else "INT64"
    return ""


def _bq_cast_comparisons(text: str) -> str:
    """Cast a column compared against numbers - the landed column is STRING."""
    depths, quoted = _sql_depth_map(text)
    pattern = re.compile(r"(" + _BQ_COLUMN_REF + r")\s*(>=|<=|<>|!=|=|>|<|not\s+in|in)\s*",
                         flags=re.IGNORECASE)
    pieces, pos = [], 0
    for m in pattern.finditer(text):
        if m.start() < pos or quoted[m.start()]:
            continue
        column = m.group(1)
        if column.split(".")[-1].lower() in _SQL_NON_COLUMN_WORDS:
            continue
        target = _bq_comparison_target(text, m.end(), depths, quoted)
        if not target:
            continue
        pieces.append(text[pos: m.start()])
        pieces.append(f"{_bq_cast(column, target)} {' '.join(m.group(2).upper().split())} ")
        pos = m.end()
    pieces.append(text[pos:])
    return "".join(pieces)


def _bq_case_result_types(text: str) -> str:
    """BigQuery will not mix a STRING column and a numeric literal in one CASE."""
    _, quoted = _sql_depth_map(text)
    marks = [(m.start(), m.end(), m.group(0).lower())
             for m in re.finditer(r"(?i)\b(case|when|then|else|end)\b", text) if not quoted[m.start()]]
    edits, stack = [], []
    for i, (_, end, word) in enumerate(marks):
        if word == "case":
            stack.append([])
        elif not stack:
            continue
        elif word in ("then", "else"):
            stop = marks[i + 1][0] if i + 1 < len(marks) else len(text)
            stack[-1].append((end, stop))
        elif word == "end":
            results = [(s, e, text[s:e].strip()) for s, e in stack.pop()]
            mixes_column = any(_SQL_IDENT_CHAIN.match(v) and v.lower() not in _SQL_NON_COLUMN_WORDS
                                for _, _, v in results)
            if mixes_column:
                edits += [(s, e, f" '{v}' ") for s, e, v in results if _BQ_NUMBER_LITERAL.match(v)]
    for start, end, replacement in sorted(edits, reverse=True):
        text = text[:start] + replacement + text[end:]
    return text


def translate_snowflake_to_bigquery(sql_text: str) -> str:
    """Rewrite the report's Snowflake query into the BigQuery dialect.

    Ordering matters: arithmetic is cast before comparisons so that a sub-query on the
    right of a comparison already advertises a numeric type, and CASE results are fixed
    last so the pass sees the literals in their final form.
    """
    text = _sql_strip_comments(str(sql_text or ""))
    if not text.strip():
        return ""
    text = _bq_table_references(text)
    text = _bq_function_names(text)
    text = _bq_substring_search(text)
    text = _bq_cast_types(text)
    text = _bq_collate(text)
    text = _bq_current_date(text)
    text = _bq_cast_aggregates(text)
    text = _bq_scaled_rounding(text)
    text = _bq_cast_arithmetic(text)
    text = _bq_cast_comparisons(text)
    text = _bq_date_to_string(text)
    text = _bq_case_result_types(text)
    return text.strip()


def _bq_format_condition(cond: str, indent: int, prefix: str) -> list:
    """Format one WHERE/AND condition, expanding an `(SELECT ...)` sub-query in place.

    Only a `(` that opens a `SELECT` at this condition's own top level counts as a
    sub-query - a `(` inside a function call such as `IN (1, 2)` is left untouched.
    """
    ind = "  " * indent
    depths, quoted = _sql_depth_map(cond)
    m = re.search(r"\(\s*select\b", cond, re.IGNORECASE)
    if not m or quoted[m.start()] or depths[m.start()] != 0:
        return [f"{ind}{prefix}{cond}"]
    open_idx = m.start()
    depth, i = 1, open_idx + 1
    while i < len(cond) and depth:
        if not quoted[i]:
            if cond[i] == "(":
                depth += 1
            elif cond[i] == ")":
                depth -= 1
        i += 1
    close_idx = i - 1
    before, inner, after = cond[:open_idx].strip(), cond[open_idx + 1:close_idx], cond[close_idx + 1:].strip()
    return [f"{ind}{prefix}{before} (", _bq_format_sql(inner, indent + 1), f"{ind}){after}"]


def _bq_format_conditions(body: str, indent: int, keyword: str) -> list:
    """Format a WHERE/HAVING body: one line if it is a single condition, else one per AND/OR."""
    depths, quoted = _sql_depth_map(body)
    bounds = [(m.start(), m.end(), m.group(1).upper()) for m in re.finditer(r"\b(and|or)\b", body, re.IGNORECASE)
              if depths[m.start()] == 0 and not quoted[m.start()]]
    conds, start, kw = [], 0, None
    for s, e, k in bounds:
        conds.append((kw, body[start:s].strip()))
        start, kw = e, k
    conds.append((kw, body[start:].strip()))

    ind = "  " * indent
    if len(conds) == 1:
        return _bq_format_condition(conds[0][1], indent, f"{keyword} ")
    lines = [f"{ind}{keyword}"]
    for kw, cond in conds:
        lines.extend(_bq_format_condition(cond, indent + 1, f"{kw} " if kw else ""))
    return lines


def _bq_format_from(body: str, indent: int) -> list:
    """One line for the base table, then one line per JOIN with its `ON` on the next line."""
    depths, quoted = _sql_depth_map(body)
    join_positions = [m.start() for m in re.finditer(r"\b(?:left|right|inner|full|cross)?\s*join\b", body, re.IGNORECASE)
                       if depths[m.start()] == 0 and not quoted[m.start()]]
    ind = "  " * indent
    lines = [f"{ind}{(body[:join_positions[0]] if join_positions else body).strip()}"]
    for i, jp in enumerate(join_positions):
        jend = join_positions[i + 1] if i + 1 < len(join_positions) else len(body)
        clause = body[jp:jend].strip()
        d2, q2 = _sql_depth_map(clause)
        on_pos = next((m.start() for m in re.finditer(r"\bon\b", clause, re.IGNORECASE)
                       if d2[m.start()] == 0 and not q2[m.start()]), None)
        if on_pos is None:
            lines.append(f"{ind}{clause}")
        else:
            lines.append(f"{ind}{clause[:on_pos].strip()}")
            lines.append(f"{ind}  ON {clause[on_pos + 2:].strip()}")
    return lines


def _bq_format_sql(text: str, indent: int = 0) -> str:
    """Pretty-print a translated query: 2-space indents, one clause/item/join per line.

    Runs purely on whitespace and depth-0 keyword positions, so it works for any query
    shape - it does not know or care about specific table or column names.
    """
    text = re.sub(r",(?=\S)", ", ", " ".join(text.split()))
    depths, quoted = _sql_depth_map(text)

    # A leading WITH clause sits entirely before the outer query's own SELECT/FROM/...
    # keywords, so it falls outside the `bounds` scan below and must be rendered (and
    # each CTE body recursively formatted) separately, or it is silently dropped.
    lines = []
    lead = re.match(r"\s*with\b", text, re.IGNORECASE)
    if lead and depths[lead.start()] == 0 and not quoted[lead.start()]:
        ctes = []
        for m in re.finditer(r"([A-Za-z_][\w$]*)\s+as\s*\(", text, re.IGNORECASE):
            open_idx = m.end() - 1
            if quoted[m.start()] or depths[open_idx] != 0:
                continue  # nested CTE reference or a CAST(... AS ...) inside an expression
            depth, i = 1, open_idx + 1
            while i < len(text) and depth:
                if not quoted[i]:
                    if text[i] == "(":
                        depth += 1
                    elif text[i] == ")":
                        depth -= 1
                i += 1
            ctes.append((m.group(1), text[open_idx + 1: i - 1]))
        if ctes:
            ind = "  " * indent
            lines.append(f"{ind}WITH")
            for n, (name, body) in enumerate(ctes):
                lines.append(f"{ind}  {name} AS (")
                lines.append(_bq_format_sql(body, indent + 2))
                lines.append(f"{ind}  ){',' if n < len(ctes) - 1 else ''}")

    bounds = [(m.start(), m.end(), m.group(1).upper())
              for m in re.finditer(r"\b(select|from|where|group by|order by|having)\b", text, re.IGNORECASE)
              if depths[m.start()] == 0 and not quoted[m.start()]]
    if not bounds:
        return f"{'  ' * indent}{text.strip()}" if not lines else "\n".join(lines)

    ind, ind1 = "  " * indent, "  " * (indent + 1)
    for i, (start, end, kw) in enumerate(bounds):
        seg_end = bounds[i + 1][0] if i + 1 < len(bounds) else len(text)
        body = text[end:seg_end].strip()
        if kw == "SELECT":
            items = _sql_split_items(body)
            if len(items) == 1:
                lines.append(f"{ind}SELECT {items[0]}")
            else:
                lines.append(f"{ind}SELECT")
                lines.extend(f"{ind1}{item}{',' if n < len(items) - 1 else ''}" for n, item in enumerate(items))
        elif kw == "FROM":
            d2, q2 = _sql_depth_map(body)
            has_join = any(d2[m.start()] == 0 and not q2[m.start()]
                           for m in re.finditer(r"\b(?:left|right|inner|full|cross)?\s*join\b", body, re.IGNORECASE))
            if has_join:
                lines.append(f"{ind}FROM")
                lines.extend(_bq_format_from(body, indent + 1))
            else:
                lines.append(f"{ind}FROM {body}")
        elif kw in ("WHERE", "HAVING"):
            lines.extend(_bq_format_conditions(body, indent, kw))
        else:
            lines.append(f"{ind}{kw} {body}")
    return "\n".join(lines)


def build_derived_table_sql(sql_text: str, rename_map: dict, model_columns) -> str:
    """The report query as BigQuery SQL whose output columns are the model's own names.

    Power BI renames columns after the query runs (`Table.RenameColumns`) and the SQL
    aliases differ in case, so the select list is relabelled to match the Power BI names.
    That is what lets every dimension stay a plain `${TABLE}.<column>` reference.
    """
    text = _sql_strip_comments(str(sql_text or ""))
    span = _sql_select_span(text)
    if span is None:
        return ""
    start, end, _ = span
    items = _sql_split_items(text[start:end])
    if not items:
        return ""
    if any(item == "*" or item.endswith(".*") for item in items):
        # A star already forwards the source names, so there is nothing to relabel.
        return _bq_format_sql(translate_snowflake_to_bigquery(text))

    alias_to_model = {str(c).strip().lower(): str(c).strip() for c in model_columns if str(c).strip()}
    for final_name, original in rename_map.items():
        model_name = alias_to_model.get(final_name)
        if model_name:
            alias_to_model[original.strip().lower()] = model_name

    rebuilt = []
    for item in items:
        expr, alias = _sql_split_alias(item)
        expr = " ".join(str(expr).split())
        if not alias and (_SQL_IDENT_CHAIN.match(expr) or _SQL_QUOTED_IDENT.match(expr)):
            alias = _sql_last_segment(expr).strip('"')
        alias = alias.strip().strip('"')
        target = alias_to_model.get(alias.lower(), alias)
        rebuilt.append(f"{expr} AS {_bq_identifier(target)}" if target else expr)

    relabelled = f"{text[:start]}\n    " + ",\n    ".join(rebuilt) + f"\n{text[end:]}"
    return _bq_format_sql(translate_snowflake_to_bigquery(relabelled))
