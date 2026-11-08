"""Parses an already-generated LookML package ZIP (not a PBIP project).

Produces the same "preview" shape ``preview_builder.build_lookml_preview``
returns for a PBIP project - ``{project_name, model_file_name, model_text,
views, explores, counts}`` - so the Compare module's diff engine
(``lookml_diff.diff_lookml_packages``) can compare a real LookML package
against another LookML package, or against a PBIP project's generated
LookML, without any special-casing.
"""
import io
import re
import zipfile
from pathlib import Path

from app.core.exceptions import InvalidZipError, LookerGenerationError

_VIEW_NAME_REGEX = re.compile(r"\bview\s*:\s*(\w+)\s*\{")
_EXPLORE_START_REGEX = re.compile(r"\bexplore\s*:\s*(\w+)\s*\{")
_JOIN_REGEX = re.compile(r"\bjoin\s*:\s*(\w+)\s*\{")


def _basename(path: str) -> str:
    return Path(path).name


def _extract_balanced_blocks(text: str, start_regex: re.Pattern[str]) -> list[tuple[str, str]]:
    """Return ``[(name, block_text)]`` for every ``keyword: name { ... }`` block.

    Matches braces rather than assuming a single line, so a multi-line
    ``explore: { ... join: { ... } ... }`` block (or a view with nested
    ``dimension_group`` blocks) is captured whole.
    """
    blocks: list[tuple[str, str]] = []
    for match in start_regex.finditer(text):
        name = match.group(1)
        depth = 0
        start = match.end() - 1  # position of the opening '{'
        for index in range(start, len(text)):
            char = text[index]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    blocks.append((name, text[match.start() : index + 1]))
                    break
    return blocks


def parse_lookml_package(upload_bytes: bytes, upload_name: str) -> dict:
    """Parse a raw LookML package ZIP into a preview-shaped dict.

    Supports both the layout this tool's own ``/convert`` generates
    (``<model>.model.lkml`` + ``views/<name>.view.lkml``, explores embedded
    in the model file) and hand-authored/older-style packages with
    per-file ``*.explore.lkml`` or single-file projects with everything
    embedded in the model file.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(upload_bytes)) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/") and not _basename(n).startswith("._")]
            contents = {name: zf.read(name).decode("utf-8", errors="replace") for name in names}
    except zipfile.BadZipFile as exc:
        raise InvalidZipError(upload_name) from exc

    lkml_names = [n for n in names if n.lower().endswith(".lkml")]
    if not lkml_names:
        raise LookerGenerationError(f"'{upload_name}' contains no .lkml files.")

    model_candidates = [n for n in lkml_names if _basename(n).lower().endswith(".model.lkml")] or [
        n for n in lkml_names if _basename(n).lower() == "model.lkml"
    ]
    model_entry = min(model_candidates, key=lambda n: (n.count("/"), n.lower()), default=None)

    model_text = contents[model_entry] if model_entry else ""
    model_file_name = _basename(model_entry) if model_entry else "model.lkml"

    view_entries = [n for n in lkml_names if _basename(n).lower().endswith(".view.lkml")]
    views = []
    for entry in view_entries:
        text = contents[entry]
        match = _VIEW_NAME_REGEX.search(text)
        view_name = match.group(1) if match else _basename(entry).removesuffix(".view.lkml")
        views.append({"view_name": view_name, "table_name": None, "file_name": _basename(entry), "lookml": text})

    # Some packages embed views directly in the model file instead of one
    # file per view - pick those up too when no standalone view files exist.
    if not views and model_text:
        for name, block in _extract_balanced_blocks(model_text, _VIEW_NAME_REGEX):
            views.append({"view_name": name, "table_name": None, "file_name": f"{name}.view.lkml", "lookml": block})

    explore_entries = [n for n in lkml_names if _basename(n).lower().endswith(".explore.lkml")]
    explores = []
    seen_explore_names: set[str] = set()
    for entry in explore_entries:
        text = contents[entry]
        match = _EXPLORE_START_REGEX.search(text)
        explore_name = match.group(1) if match else _basename(entry).removesuffix(".explore.lkml")
        explores.append(
            {
                "explore_name": explore_name,
                "table_name": None,
                "file_name": _basename(entry),
                "join_count": len(_JOIN_REGEX.findall(text)),
                "lookml": text,
            }
        )
        seen_explore_names.add(explore_name)

    # This tool's own /convert output (and most generated projects) embed
    # explores inside the model file rather than one file per explore.
    for name, block in _extract_balanced_blocks(model_text, _EXPLORE_START_REGEX):
        if name in seen_explore_names:
            continue
        explores.append(
            {
                "explore_name": name,
                "table_name": None,
                "file_name": f"{name}.explore.lkml",
                "join_count": len(_JOIN_REGEX.findall(block)),
                "lookml": block,
            }
        )
        seen_explore_names.add(name)

    if model_entry:
        project_name = _basename(model_entry).removesuffix(".model.lkml")
    else:
        project_name = Path(upload_name).stem.removesuffix(".zip") or "LookML Package"

    return {
        "project_name": project_name,
        "model_file_name": model_file_name,
        "model_text": model_text,
        "views": views,
        "explores": explores,
        "counts": {"views": len(views), "explores": len(explores)},
    }
