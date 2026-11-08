"""LookML project packaging.

Adapted from the source tool's ``write_lookml_package`` /
``write_lookml``: instead of writing files to disk, an in-memory ZIP
is built so it can be streamed straight back as an HTTP response. The
folder layout (``<model>.model.lkml`` + ``views/<name>.view.lkml``)
and file-naming/dedup logic are preserved exactly.
"""
import datetime
import io
import re
import zipfile
from pathlib import Path

from app.services.looker.lookml_naming import safe_model_name


def build_lookml_package_name(pbip_path: Path, when: datetime.datetime | None = None) -> str:
    """Folder name for the generated project: <PBIP name>_LookML_YYYY-MM-DD_HHMM."""
    when = when or datetime.datetime.now().astimezone()
    safe_stem = re.sub(r"[^\w\-. ]+", "_", pbip_path.stem).strip() or "PowerBI"
    return f"{safe_stem}_LookML_{when.strftime('%Y-%m-%d_%H%M')}"


def build_lookml_output_name(pbip_path: Path, when: datetime.datetime | None = None) -> str:
    """Legacy single-file name. Kept for parity with the merge path and older callers."""
    return f"{build_lookml_package_name(pbip_path, when)}.lkml"


def _write_project_files(zf: zipfile.ZipFile, folder_name: str, model_file_name: str, model_text: str, views: list) -> None:
    """Writes one project's `<model>.model.lkml` + `views/<name>.view.lkml` into an
    already-open ZipFile under ``folder_name``. Shared by the single-project packager
    (below) and the bulk packager so the per-view naming/dedup logic exists exactly once.
    """
    zf.writestr(f"{folder_name}/{model_file_name}", model_text.rstrip() + "\n")

    used = set()
    for v in views:
        base = str(v.get("view_name") or safe_model_name(v.get("table_name"))).strip() or "unnamed"
        # Two Power BI tables can collapse onto the same snake_case name ('Dim Store' /
        # 'Dim_Store'); suffix rather than silently overwrite one with the other.
        name, n = base, 2
        while name in used:
            name = f"{base}_{n}"
            n += 1
        used.add(name)

        zf.writestr(f"{folder_name}/views/{name}.view.lkml", str(v.get("lookml") or "").rstrip() + "\n")


def build_lookml_zip(model_stem: str, model_text: str, views: list) -> tuple[bytes, str]:
    """Build a Looker-style project as an in-memory ZIP: <model>.model.lkml plus views/<name>.view.lkml.

    Looker expects one view per file, so the single-file output is split here rather than
    in the builders - build_lookml_views() already hands back one text block per view.

    Returns (zip_bytes, package_folder_name).
    """
    package_name = build_lookml_package_name(Path(model_stem))
    model_file_name = f"{safe_model_name(model_stem)}.model.lkml"

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        _write_project_files(zf, package_name, model_file_name, model_text, views)

    return buffer.getvalue(), package_name


def build_bulk_lookml_zip(project_results: list[tuple[str, str, list]], root_folder: str = "Generated_LookML_Projects") -> bytes:
    """Packages many converted projects into a single ZIP, each isolated in its own
    `<root_folder>/<project_name>/` subfolder - same file layout `build_lookml_zip`
    produces per project, just aggregated so bulk conversion downloads as one archive.

    ``project_results`` is a list of ``(project_name, model_text, views)`` tuples, exactly
    what each project's `build_lookml_model()` call already returns (minus the counts dict).
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for project_name, model_text, views in project_results:
            model_file_name = f"{safe_model_name(project_name)}.model.lkml"
            _write_project_files(zf, f"{root_folder}/{project_name}", model_file_name, model_text, views)
    return buffer.getvalue()
