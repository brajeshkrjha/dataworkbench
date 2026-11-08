"""Text/M-query utility helpers.

Ported verbatim from the source tool - regexes tuned to real Power
Query (M) and TMDL quirks.
"""
import logging
import re

logger = logging.getLogger(__name__)

TABLE_FIELD_REGEX = re.compile(r"'([^']+)'\[([^\]]+)\]")
SOURCE_LINE_REGEX = re.compile(r"\bSource\s*=\s*(.+)", re.IGNORECASE)
SQL_FROM_JOIN_REGEX = re.compile(r"\b(?:FROM|JOIN)\s+([A-Za-z0-9_\.\"\[\]]+)", re.IGNORECASE)
SNOWFLAKE_DB_CALL_REGEX = re.compile(
    r"Snowflake\.Databases\(\s*\"[^\"]*\"\s*,\s*\"([^\"]+)\"\s*,\s*\[(.*?)\]\s*\)",
    re.IGNORECASE | re.DOTALL,
)
SNOWFLAKE_ROLE_REGEX = re.compile(r"\bRole\s*=\s*\"([^\"]+)\"", re.IGNORECASE)
SNOWFLAKE_DB_NAME_REGEX = re.compile(r"\{\s*\[Name\s*=\s*\"([^\"]+)\"\]\s*\}\s*\[Data\]", re.IGNORECASE)


def get_current_user() -> str:
    """Best-effort identity of whoever generated the document.

    Kept for LookML header provenance (``Generated: ... by <user>``);
    unlike the desktop tool there is no interactive login, so this
    reads whatever process-level identity is available in the
    container/host running the backend.
    """
    import os

    for value in (
        os.environ.get("USERNAME"),
        os.environ.get("USER"),
        _safe_getlogin(),
    ):
        if value:
            domain = os.environ.get("USERDOMAIN", "")
            return f"{domain}\\{value}" if domain else str(value)
    return "unknown"


def _safe_getlogin() -> str:
    import getpass

    try:
        return getpass.getuser()
    except Exception:
        logger.debug("Process identity unavailable", exc_info=True)
        return ""


def clean_query_text(text: str) -> str:
    # Power Query stores newlines/tabs as literal "#(lf)" tokens inside the TMDL,
    # and JSON escaping adds another layer on top. Undo both so the SQL is readable.
    if not text:
        return ""
    cleaned = text
    cleaned = cleaned.replace("#(lf)", "\n")
    cleaned = cleaned.replace("#(tab)", "\t")
    cleaned = cleaned.replace("#(cr)", "\r")
    cleaned = cleaned.replace("\\r\\n", "\n").replace("\\n", "\n")
    cleaned = cleaned.replace("\\\"", '"')
    return cleaned.strip()


def _m_unquote(raw: str) -> str:
    # Walks a single M string literal by hand (instead of a regex) because the SQL
    # it wraps almost always contains its own escaped quotes ("") and a regex has
    # no way to tell those apart from the literal's real closing quote.
    text = raw.strip()
    if not text.startswith('"'):
        return ""
    i = 1
    out = []
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == '"':
            if i + 1 < n and text[i + 1] == '"':
                out.append('"')
                i += 2
                continue
            break
        out.append(ch)
        i += 1
    return "".join(out)


def _m_call_arguments(text: str, open_paren_idx: int):
    # Splits a function call's argument list on its top-level commas, tracking M's
    # (), [] and {} nesting plus quoted strings (with "" escaping) so a comma or
    # bracket that belongs to an earlier argument - e.g. the connection details in
    # Value.NativeQuery(Snowflake.Databases("host", "wh", [Role="x"]), "SELECT ...")
    # - never gets mistaken for the boundary of the SQL-string argument.
    depth = 0
    quote = False
    i = start = open_paren_idx + 1
    n = len(text)
    args = []
    while i < n:
        ch = text[i]
        if quote:
            if ch == '"':
                if i + 1 < n and text[i + 1] == '"':
                    i += 2
                    continue
                quote = False
            i += 1
            continue
        if ch == '"':
            quote = True
            i += 1
            continue
        if ch in "([{":
            depth += 1
            i += 1
            continue
        if ch in ")]}":
            if depth == 0:
                args.append(text[start:i])
                return args
            depth -= 1
            i += 1
            continue
        if ch == "," and depth == 0:
            args.append(text[start:i])
            start = i + 1
            i += 1
            continue
        i += 1
    args.append(text[start:i])
    return args


def extract_source_name(m_query: str) -> str:
    if not m_query:
        return ""
    for line in m_query.splitlines():
        m = SOURCE_LINE_REGEX.search(line)
        if m:
            raw = m.group(1).strip()
            return raw[:500]
    return ""


def extract_sql_fragment(m_query: str) -> str:
    # Only native SQL is of interest here - if there's no Value.NativeQuery call
    # then the table is folded/M-only and there is no SQL to show.
    if not m_query:
        return ""

    text = clean_query_text(m_query)
    lower = text.lower()
    call_pos = lower.find("value.nativequery")
    if call_pos < 0:
        return ""

    open_paren = text.find("(", call_pos)
    sql = ""
    if open_paren >= 0:
        # Value.NativeQuery(connection, query, parameters, options) - the query is
        # always the 2nd argument, however many commas/quotes the connection (1st)
        # argument itself contains.
        args = _m_call_arguments(text, open_paren)
        if len(args) >= 2:
            sql = _m_unquote(args[1])

    sql = clean_query_text(sql).strip()
    return sql


def detect_source_details(source_name: str, m_query: str = "", query_text: str = ""):
    # Works out where a table actually comes from. All three text blobs get searched
    # because the connector call sometimes sits in the source line and sometimes only
    # in the full M query. Warehouse/role/database are Snowflake-specific.
    raw = "\n".join([str(source_name or ""), str(m_query or ""), str(query_text or "")]).strip()
    check = raw.lower()

    source_type = "other"
    if "snowflake.databases(" in check:
        source_type = "snowflake"
    elif "powerbi.dataflows(" in check:
        source_type = "dataflow"
    elif "table.fromrows(" in check or "binary.decompress(" in check:
        source_type = "inline"

    warehouse = ""
    role_name = ""
    db_name = ""

    if source_type == "snowflake":
        parse_text = clean_query_text(raw).replace('""', '"')
        wm = SNOWFLAKE_DB_CALL_REGEX.search(parse_text)
        if wm:
            warehouse = (wm.group(1) or "").strip()
            role_candidate = wm.group(2) or ""
            rm = SNOWFLAKE_ROLE_REGEX.search(role_candidate)
            if rm:
                role_name = (rm.group(1) or "").strip()

        if not role_name:
            rm = SNOWFLAKE_ROLE_REGEX.search(parse_text)
            if rm:
                role_name = (rm.group(1) or "").strip()

        dm = SNOWFLAKE_DB_NAME_REGEX.search(parse_text)
        if dm:
            db_name = (dm.group(1) or "").strip()

    return {
        "source_type": source_type,
        "warehouse_name": warehouse,
        "role_name": role_name,
        "database_name": db_name,
    }


def extract_sql_tables(sql_text: str):
    if not sql_text:
        return []
    tables = []
    for t in SQL_FROM_JOIN_REGEX.findall(sql_text):
        name = t.strip().strip(",")
        if name:
            tables.append(name)
    return sorted(set(tables))
