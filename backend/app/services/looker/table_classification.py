"""Table classification: facts / dimensions / parameter tables.

Ported verbatim from the source tool.
"""
import pandas as pd


def classify_model_tables(tables_df: pd.DataFrame, relationships_df: pd.DataFrame):
    """Split tables into facts / dimensions / parameter tables.

    A fact is the 'many' side of relationships - it points *out* to dimensions.
    We use outbound relationship count as the signal, with a name-prefix fallback.
    Not perfect: a dimension that filters another dimension will look like a fact
    and get its own explore. Harmless, just an extra explore to delete.
    """
    names = []
    if isinstance(tables_df, pd.DataFrame) and not tables_df.empty and "table_name" in tables_df.columns:
        names = [str(n).strip() for n in tables_df["table_name"].dropna().unique() if str(n).strip()]

    outbound, inbound = {}, {}
    if isinstance(relationships_df, pd.DataFrame) and not relationships_df.empty:
        for _, rel in relationships_df.iterrows():
            frm = str(rel.get("from_table") or "").strip()
            to = str(rel.get("to_table") or "").strip()
            if frm:
                outbound[frm] = outbound.get(frm, 0) + 1
            if to:
                inbound[to] = inbound.get(to, 0) + 1
            for extra in (frm, to):
                if extra and extra not in names:
                    names.append(extra)

    facts, dimensions, params = [], [], []
    for name in sorted(set(names)):
        lowered = name.lower()
        if lowered.startswith(("param_", "_")):
            params.append(name)
        elif outbound.get(name, 0) > 0 or lowered.startswith("fact"):
            facts.append(name)
        else:
            dimensions.append(name)

    return {"facts": facts, "dimensions": dimensions, "parameters": params, "outbound": outbound, "inbound": inbound}
