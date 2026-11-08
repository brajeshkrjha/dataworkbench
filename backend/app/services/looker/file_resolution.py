"""PBIP project file discovery.

Ported verbatim (structure only) from ``resolve_pbip_roots`` and the
low-level file-reading helpers in the source tool. A `.pbip` file is
only a pointer - the real content lives in sibling folders named
``<Name>.Report`` and ``<Name>.SemanticModel``. This module locates
those folders on disk (an extracted temp directory in this context)
exactly as the desktop tool did for a local file.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def read_text(path: Path) -> str | None:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return path.read_text(encoding=enc)
        except Exception:
            logger.debug("Text decoding failed; trying the next encoding", exc_info=True)
            continue
    return None


def safe_json_load(path: Path):
    text = read_text(path)
    if not text:
        return None
    cleaned = text.strip("\ufeff\x00 \t\r\n")
    if not cleaned:
        return None
    try:
        return json.loads(cleaned)
    except Exception:
        logger.debug("Ignoring unreadable project JSON", exc_info=True)
        return None


def safe_json_dumps(value, limit: int = 12000) -> str:
    try:
        text = json.dumps(value, ensure_ascii=False)
    except Exception:
        logger.debug("JSON serialization unavailable; using text fallback", exc_info=True)
        text = str(value)
    return text[:limit]


def recursive_dicts(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from recursive_dicts(v)
    elif isinstance(obj, list):
        for i in obj:
            yield from recursive_dicts(i)


def resolve_pbip_roots(pbip_file: Path):
    """Locate the ``.Report`` and ``.SemanticModel`` folders next to a .pbip file.

    A .pbip is just a pointer file - the real content lives in sibling folders
    named "<Name>.Report" and "<Name>.SemanticModel". Matching on the stem matters:
    if someone has several PBIP projects in the same folder a plain glob happily
    picks up the wrong project's folders.
    """
    root = pbip_file.parent
    stem = pbip_file.stem

    report_root = None
    model_root = None

    # 1) Preferred: follow the artifact paths declared inside the .pbip file itself.
    pbip_json = safe_json_load(pbip_file)
    if isinstance(pbip_json, dict):
        for art in pbip_json.get("artifacts", []) or []:
            if not isinstance(art, dict):
                continue
            for key, val in art.items():
                if not isinstance(val, dict):
                    continue
                rel_path = val.get("path")
                if not rel_path:
                    continue
                candidate = (root / str(rel_path)).resolve()
                if not candidate.exists():
                    continue
                key_lower = str(key).lower()
                if "report" in key_lower and report_root is None:
                    report_root = candidate
                elif ("dataset" in key_lower or "semanticmodel" in key_lower) and model_root is None:
                    model_root = candidate

    # 2) Next: folders named exactly after the .pbip file (handles multiple projects per folder).
    if report_root is None:
        named_report = root / f"{stem}.Report"
        if named_report.exists():
            report_root = named_report
    if model_root is None:
        named_model = root / f"{stem}.SemanticModel"
        if named_model.exists():
            model_root = named_model

    # 3) Next: standard sub-folder layout.
    if report_root is None and (root / "Report").exists():
        report_root = root / "Report"
    if model_root is None and (root / "SemanticModel").exists():
        model_root = root / "SemanticModel"

    # 4) Last resort: only fall back to scanning when the .pbip is alone in its folder.
    if report_root is None or model_root is None:
        pbip_siblings = [p for p in root.glob("*.pbip") if p.is_file()]
        if len(pbip_siblings) <= 1:
            for p in root.iterdir():
                if not p.is_dir():
                    continue
                if report_root is None and p.name.endswith(".Report"):
                    report_root = p
                if model_root is None and p.name.endswith(".SemanticModel"):
                    model_root = p

    return root, report_root, model_root
