"""TMDL (Tabular Model Definition Language) parsing.

Ported verbatim from the source tool's TMDL parsing functions. These
regexes and state machines were tuned against real-world PBIP quirks
(see inline comments) and must not be simplified.
"""
import re

from app.services.looker.text_utils import clean_query_text, extract_source_name

TMDL_MEASURE_REGEX = re.compile(r"^\s*measure\s+([^=\n]+?)\s*=", re.IGNORECASE | re.MULTILINE)
REL_FROM_TO_REGEX = re.compile(
    r"fromColumn\s*[:=]\s*'?([^'\[]+)'?\[([^\]]+)\].*?toColumn\s*[:=]\s*'?([^'\[]+)'?\[([^\]]+)\]",
    re.IGNORECASE | re.DOTALL,
)
REL_BLOCK_REGEX = re.compile(
    r"^\s*relationship\s+([^\n=]+?)\s*(?:=\s*([^\n]+))?\n(.*?)(?=^\s*relationship\s+|\Z)",
    re.IGNORECASE | re.DOTALL | re.MULTILINE,
)
REL_COL_REF_REGEX = re.compile(r"'((?:''|[^'])+)'\[([^\]]+)\]|([A-Za-z0-9_]+)\[([^\]]+)\]")
REL_DOT_REF_REGEX = re.compile(
    r"^\s*(?:'(?P<qt>(?:''|[^'])+)'|(?P<t>[^.'\s][^.]*?))\s*\.\s*(?:'(?P<qc>(?:''|[^'])+)'|(?P<c>.+?))\s*$"
)

CARDINALITY_NOTES = {
    "many-to-one": "Standard star-schema join (fact → dimension).",
    "one-to-many": "Standard join defined from the dimension side.",
    "one-to-one": "Both sides unique - often a candidate to merge into one table.",
    "many-to-many": "Uses a bridge/composite key - can be slow and may double-count.",
}

# Matches a fully qualified measure reference: 'Table'[Measure] or Table[Measure].
_MEASURE_REF_REGEX = re.compile(r"^\s*(?:'([^']+)'|([\w ]+))?\s*\[([^\]]+)\]\s*$")


def _tmdl_unquote(name: str) -> str:
    value = str(name or "").strip()
    if value.startswith("'") and value.endswith("'") and len(value) >= 2:
        value = value[1:-1].replace("''", "'")
    return value.strip()


def _split_measure_ref(raw: str):
    """Split 'Calc_RC'[FD Accept to Delivery] into ("Calc_RC", "FD Accept to Delivery").

    A plain measure name comes back unchanged with an empty table. Needed because
    the fallback scan in parse_model sees declarations written either way.
    """
    text = str(raw or "").strip()
    match = _MEASURE_REF_REGEX.match(text)
    if match:
        return (match.group(1) or match.group(2) or "").strip(), match.group(3).strip()
    return "", _tmdl_unquote(text)


def _indent_width(line: str) -> int:
    return len(line) - len(line.lstrip("\t "))


def _tmdl_split_name_expr(rest: str):
    """Split a TMDL declaration tail into (name, inline_expression).

    Names may be single-quoted and may legitimately contain '=' -- for example
    `measure 'Margin = %' = DIVIDE(...)`. A naive split on the first '=' chops
    the name in half and drags the remainder into the DAX, so walk the string
    and only treat '=' as the separator when we are outside quotes.
    Returns (name, expr_or_None); expr is None when there is no '=' at all.
    """
    in_quote = False
    k = 0
    length = len(rest)
    while k < length:
        ch = rest[k]
        if ch == "'":
            # '' is an escaped quote inside a quoted name, not a delimiter.
            if in_quote and k + 1 < length and rest[k + 1] == "'":
                k += 2
                continue
            in_quote = not in_quote
        elif ch == "=" and not in_quote:
            return rest[:k].strip(), rest[k + 1:].strip()
        k += 1
    return rest.strip(), None


def _tmdl_is_hidden_line(content: str):
    """Return True/False for a TMDL hidden flag line, or None when unrelated.

    Power BI writes the flag either bare (`isHidden`) or with an explicit value
    (`isHidden: true`). Only the bare form was recognised before, so any column
    or measure saved with the explicit form was reported as visible.
    """
    low = content.strip().lower()
    if low == "ishidden" or low.endswith("= ishidden"):
        return True
    m = re.match(r"^ishidden\s*[:=]\s*(.+)$", low)
    if m:
        return m.group(1).strip().strip("'\"") not in ("false", "0", "no")
    return None


def parse_tmdl_table(text: str):
    """Parse a TMDL table file into table name, columns, measures, hierarchies and partitions."""
    result = {"table_name": "", "columns": [], "measures": [], "hierarchies": [], "partitions": [], "is_hidden": False}
    if not text:
        return result

    lines = text.splitlines()

    for line in lines:
        m = re.match(r"^table\s+(.+?)\s*$", line)
        if m:
            result["table_name"] = _tmdl_unquote(m.group(1))
            break

    i = 0
    total = len(lines)
    while i < total:
        line = lines[i]
        stripped = line.strip()

        # ---- column blocks ----
        cm = re.match(r"^column\s+(.+)$", stripped)
        if cm and not stripped.startswith("columns"):
            base_indent = _indent_width(line)
            col_name, inline_expr_raw = _tmdl_split_name_expr(cm.group(1))
            col_name = _tmdl_unquote(col_name)
            inline_expr = (inline_expr_raw or "").strip()
            expr_lines = [inline_expr] if inline_expr and inline_expr != "```" else []
            props = {"dataType": "", "formatString": "", "sortByColumn": "", "displayFolder": "", "description": "", "sourceColumn": "", "dataCategory": "", "summarizeBy": ""}
            hidden = False
            capturing_expr = inline_expr_raw is not None

            j = i + 1
            while j < total:
                nxt = lines[j]
                if nxt.strip() and _indent_width(nxt) <= base_indent:
                    break
                content = nxt.strip()

                matched_prop = False
                for key in props:
                    pm2 = re.match(rf"^{key}:\s*(.*)$", content, re.IGNORECASE)
                    if pm2:
                        props[key] = pm2.group(1).strip().strip("'\"")
                        matched_prop = True
                        capturing_expr = False
                        break

                if matched_prop:
                    j += 1
                    continue
                hidden_flag = _tmdl_is_hidden_line(content)
                if hidden_flag is not None:
                    hidden = hidden_flag
                    capturing_expr = False
                    j += 1
                    continue
                if content.startswith(("lineageTag:", "annotation ", "changedProperty", "extendedProperty", "relatedColumnDetails", "groupByColumn", "variation ", "isNameInferred", "isDataTypeInferred")):
                    capturing_expr = False
                    j += 1
                    continue
                if content == "```":
                    j += 1
                    continue
                if capturing_expr and content:
                    expr_lines.append(nxt)
                j += 1

            if col_name:
                expression = clean_query_text("\n".join(expr_lines))[:8000]
                result["columns"].append(
                    {
                        "column_name": col_name,
                        "data_type": props["dataType"],
                        "is_calculated": "Yes" if expression else "No",
                        "expression": expression,
                        "is_hidden": "Yes" if hidden else "No",
                        "format_string": props["formatString"],
                        "sort_by_column": props["sortByColumn"],
                        "display_folder": props["displayFolder"],
                        "source_column": props["sourceColumn"],
                        "summarize_by": props["summarizeBy"],
                        "data_category": props["dataCategory"],
                        "description": props["description"],
                    }
                )
            i = j
            continue

        # ---- hierarchy blocks ----
        hm = re.match(r"^hierarchy\s+(.+?)\s*$", stripped)
        if hm:
            base_indent = _indent_width(line)
            hier_name = _tmdl_unquote(hm.group(1))
            levels = []
            j = i + 1
            while j < total:
                nxt = lines[j]
                if nxt.strip() and _indent_width(nxt) <= base_indent:
                    break
                lm = re.match(r"^level\s+(.+?)\s*$", nxt.strip())
                if lm:
                    levels.append(_tmdl_unquote(lm.group(1)))
                j += 1

            if hier_name:
                result["hierarchies"].append(
                    {
                        "hierarchy_name": hier_name,
                        "level_count": len(levels),
                        "levels": " > ".join(levels),
                    }
                )
            i = j
            continue

        # ---- measure blocks ----
        mm = re.match(r"^measure\s+(.+)$", stripped)
        if mm:
            base_indent = _indent_width(line)
            measure_name_raw, first_part_raw = _tmdl_split_name_expr(mm.group(1))
            measure_name = _tmdl_unquote(measure_name_raw)
            first_part = (first_part_raw or "").strip()
            expr_lines = [first_part] if first_part and first_part != "```" else []
            mprops = {"formatString": "", "displayFolder": "", "description": "", "dataType": "", "dataCategory": ""}
            mhidden = False

            j = i + 1
            while j < total:
                nxt = lines[j]
                if nxt.strip() and _indent_width(nxt) <= base_indent:
                    break
                content = nxt.strip()

                # Measure metadata used to be discarded, which meant display
                # folders never made it to the report and stray property lines
                # such as `description:` were swallowed into the DAX text.
                matched_prop = False
                for key in mprops:
                    pm3 = re.match(rf"^{key}:\s*(.*)$", content, re.IGNORECASE)
                    if pm3:
                        mprops[key] = pm3.group(1).strip().strip("'\"")
                        matched_prop = True
                        break
                if matched_prop:
                    j += 1
                    continue

                hidden_flag = _tmdl_is_hidden_line(content)
                if hidden_flag is not None:
                    mhidden = hidden_flag
                    j += 1
                    continue

                if content.startswith(("lineageTag:", "annotation ", "changedProperty", "extendedProperty", "kpi ", "sortByColumn:")):
                    j += 1
                    continue
                if content == "```":
                    j += 1
                    continue
                expr_lines.append(nxt)
                j += 1

            if measure_name:
                result["measures"].append(
                    {
                        "measure_name": measure_name,
                        "expression": clean_query_text("\n".join(expr_lines))[:12000],
                        "display_folder": mprops["displayFolder"],
                        "is_hidden": "Yes" if mhidden else "No",
                        "format_string": mprops["formatString"],
                        "description": mprops["description"],
                    }
                )
            i = j
            continue

        # ---- partition blocks ----
        pm = re.match(r"^partition\s+(.+?)\s*=\s*(\w+)\s*$", stripped)
        if pm:
            base_indent = _indent_width(line)
            partition_name = _tmdl_unquote(pm.group(1))
            partition_kind = (pm.group(2) or "").strip()
            mode_value = ""
            source_lines = []
            capturing = False
            source_indent = None

            j = i + 1
            while j < total:
                nxt = lines[j]
                if nxt.strip() and _indent_width(nxt) <= base_indent:
                    break

                content = nxt.strip()
                if not capturing:
                    mo = re.match(r"^mode:\s*(.+)$", content)
                    if mo:
                        mode_value = mo.group(1).strip()
                        j += 1
                        continue
                    so = re.match(r"^source\s*=\s*(.*)$", content)
                    if so:
                        capturing = True
                        source_indent = _indent_width(nxt)
                        inline = so.group(1).strip()
                        if inline and inline != "```":
                            source_lines.append(inline)
                        j += 1
                        continue
                else:
                    if content.startswith("annotation ") and _indent_width(nxt) <= (source_indent or 0):
                        break
                    if content == "```":
                        j += 1
                        continue
                    source_lines.append(nxt)
                j += 1

            result["partitions"].append(
                {
                    "partition_name": partition_name,
                    "partition_kind": partition_kind,
                    "mode": mode_value,
                    "expression": clean_query_text("\n".join(source_lines))[:20000],
                }
            )
            i = j
            continue

        i += 1

    return result


def parse_tmdl_role(text: str):
    """Parse a TMDL role file into role name, permission and table-level RLS filters."""
    result = {"role_name": "", "model_permission": "", "filters": []}
    if not text:
        return result

    rm = re.search(r"^role\s+(.+?)\s*$", text, re.MULTILINE)
    if rm:
        result["role_name"] = _tmdl_unquote(rm.group(1))

    pm = re.search(r"^\s*modelPermission:\s*(.+?)\s*$", text, re.MULTILINE)
    if pm:
        result["model_permission"] = pm.group(1).strip()

    for tm in re.finditer(r"^\s*tablePermission\s+(.+?)\s*=\s*(.*)$", text, re.MULTILINE):
        result["filters"].append(
            {
                "table_name": _tmdl_unquote(tm.group(1)),
                "filter_expression": clean_query_text(tm.group(2))[:4000],
            }
        )

    return result


def parse_tmdl_expressions(text: str):
    """Parse shared expressions / parameters from expressions.tmdl."""
    rows = []
    if not text:
        return rows

    lines = text.splitlines()
    i, total = 0, len(lines)
    while i < total:
        line = lines[i]
        em = re.match(r"^expression\s+(.+?)\s*=\s*(.*)$", line.strip())
        if not em:
            i += 1
            continue

        base_indent = _indent_width(line)
        name = _tmdl_unquote(em.group(1))
        inline = em.group(2).strip()
        expr_lines = [inline] if inline and inline != "```" else []

        j = i + 1
        while j < total:
            nxt = lines[j]
            if nxt.strip() and _indent_width(nxt) <= base_indent:
                break
            content = nxt.strip()
            if content.startswith(("lineageTag:", "annotation ", "queryGroup:")) or content == "```":
                j += 1
                continue
            expr_lines.append(nxt)
            j += 1

        expr = clean_query_text("\n".join(expr_lines))
        rows.append(
            {
                "name": name,
                "kind": "parameter" if re.search(r"IsParameterQuery", expr, re.IGNORECASE) else "expression",
                "source_name": extract_source_name(expr),
                "expression": expr[:12000],
            }
        )
        i = j

    return rows


def parse_table_column_ref(ref: str):
    if not ref:
        return None

    text = str(ref).strip().rstrip(",")
    if not text:
        return None

    # Bracket notation: 'Table Name'[Column] or Table[Column]
    m = REL_COL_REF_REGEX.search(text)
    if m:
        if m.group(1) is not None:
            table = m.group(1).replace("''", "'").strip()
            col = (m.group(2) or "").strip()
        else:
            table = (m.group(3) or "").strip()
            col = (m.group(4) or "").strip()
        if table and col:
            return table, col

    # TMDL dot notation: Table.Column, 'Table Name'.Column, Table.'Column Name'
    m2 = REL_DOT_REF_REGEX.match(text)
    if m2:
        table = (m2.group("qt") or m2.group("t") or "").replace("''", "'").strip()
        col = (m2.group("qc") or m2.group("c") or "").replace("''", "'").strip()
        if table and col:
            return table, col

    return None


def _build_cardinality(inline_value: str, from_card: str, to_card: str) -> str:
    """Resolve a relationship's cardinality.

    TMDL only writes a property when it differs from the default, so a relationship
    with no cardinality lines at all is many-to-one (the Power BI default), NOT unknown.
    Defaults: fromCardinality = many, toCardinality = one.
    """
    inline = (inline_value or "").strip()
    if inline and not from_card and not to_card:
        # e.g. "relationship X = manyToMany" style inline declarations.
        normalised = re.sub(r"[\s_]+", "", inline).lower()
        known = {
            "manytomany": "many-to-many",
            "manytoone": "many-to-one",
            "onetomany": "one-to-many",
            "onetoone": "one-to-one",
        }
        if normalised in known:
            return known[normalised]

    frm = (from_card or "many").strip().lower()
    to = (to_card or "one").strip().lower()
    return f"{frm}-to-{to}"


def extract_relationships_from_text(text: str, rel_file: str):
    rows = []
    if not text:
        return rows

    legacy_rows = []
    for m in REL_FROM_TO_REGEX.finditer(text):
        from_table = (m.group(1) or "").strip()
        from_col = (m.group(2) or "").strip()
        to_table = (m.group(3) or "").strip()
        to_col = (m.group(4) or "").strip()
        if from_table and from_col and to_table and to_col:
            legacy_rows.append(
                {
                    "file_path": rel_file,
                    "name": "",
                    "from_table": from_table,
                    "from_column": from_col,
                    "to_table": to_table,
                    "to_column": to_col,
                    "is_active": "true",
                    "cross_filtering_behavior": "singleDirection",
                    "cardinality": "many-to-one",
                }
            )

    # Stronger TMDL block parser for relationship definitions.
    for blk in REL_BLOCK_REGEX.finditer(text):
        rel_name = (blk.group(1) or "").strip()
        cardinality = (blk.group(2) or "").strip()
        body = blk.group(3) or ""

        from_line = re.search(r"^\s*fromColumn\s*:\s*(.+)$", body, re.IGNORECASE | re.MULTILINE)
        to_line = re.search(r"^\s*toColumn\s*:\s*(.+)$", body, re.IGNORECASE | re.MULTILINE)
        is_active_line = re.search(r"^\s*isActive\s*:\s*(\w+)", body, re.IGNORECASE | re.MULTILINE)
        cross_line = re.search(r"^\s*crossFilteringBehavior\s*:\s*([^\n]+)", body, re.IGNORECASE | re.MULTILINE)
        from_card_line = re.search(r"^\s*fromCardinality\s*:\s*([^\n]+)", body, re.IGNORECASE | re.MULTILINE)
        to_card_line = re.search(r"^\s*toCardinality\s*:\s*([^\n]+)", body, re.IGNORECASE | re.MULTILINE)

        if not from_line or not to_line:
            continue

        from_ref = parse_table_column_ref((from_line.group(1) or "").strip())
        to_ref = parse_table_column_ref((to_line.group(1) or "").strip())
        if not from_ref or not to_ref:
            continue

        rows.append(
            {
                "file_path": rel_file,
                "name": rel_name,
                "from_table": from_ref[0],
                "from_column": from_ref[1],
                "to_table": to_ref[0],
                "to_column": to_ref[1],
                "is_active": (is_active_line.group(1).strip() if is_active_line else "true"),
                "cross_filtering_behavior": (cross_line.group(1).strip() if cross_line else "singleDirection"),
                "cardinality": _build_cardinality(
                    cardinality,
                    from_card_line.group(1).strip() if from_card_line else "",
                    to_card_line.group(1).strip() if to_card_line else "",
                ),
            }
        )

    # The bracket-notation scan is only a fallback; never let it duplicate block results.
    if not rows:
        rows.extend(legacy_rows)

    return rows
