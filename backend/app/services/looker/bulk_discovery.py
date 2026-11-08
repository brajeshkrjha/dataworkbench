"""Discovery of multiple PBIP projects inside a single "parent folder" upload.

Reuses the existing single-project file-resolution logic
(`file_resolution.resolve_pbip_roots`, `pipeline.find_all_pbip_candidates`)
unchanged - bulk discovery is purely "find every .pbip instead of the first
one that resolves, and classify each instead of raising on the first
failure".
"""
import io
import shutil
import tempfile
import zipfile
from pathlib import Path

from app.core.exceptions import InvalidZipError
from app.services.looker.file_resolution import resolve_pbip_roots
from app.services.looker.pipeline import find_all_pbip_candidates

# Same exclusion rules the single-project folder-upload flow uses on the frontend
# (project-collector.ts::PBI_CACHE_PATH / JUNK_PATH), applied here so a multi-gigabyte
# Power BI Desktop cache folder never gets extracted for dozens of projects at once.
_SKIP_SUFFIXES = (".ds_store", "thumbs.db")


def _should_skip_zip_entry(name: str) -> bool:
    lowered = name.replace("\\", "/").lower()
    if "/.pbi/" in f"/{lowered}":
        return True
    if lowered.endswith("cache.abf"):
        return True
    if lowered.endswith(_SKIP_SUFFIXES):
        return True
    if "__macosx/" in lowered:
        return True
    return Path(name).name.startswith("._")


def extract_bulk_upload(upload_bytes: bytes, upload_name: str) -> Path:
    """Extracts a parent-folder ZIP to a fresh temp directory, skipping Power BI
    cache/junk artifacts. The caller owns the returned directory and must remove it
    (e.g. via ``shutil.rmtree``) once processing is finished - it deliberately outlives
    this call so a background job can keep reading from it after the request returns.
    """
    extract_root = Path(tempfile.mkdtemp(prefix="looker-bulk-"))
    try:
        with zipfile.ZipFile(io.BytesIO(upload_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                if _should_skip_zip_entry(info.filename):
                    continue
                zf.extract(info, extract_root)
    except zipfile.BadZipFile as exc:
        shutil.rmtree(extract_root, ignore_errors=True)
        raise InvalidZipError(upload_name) from exc
    except BaseException:
        shutil.rmtree(extract_root, ignore_errors=True)
        raise
    return extract_root


class DiscoveredProject:
    """One `.pbip` found in a bulk upload, classified valid/invalid up front."""

    def __init__(
        self,
        pbip_file: Path,
        project_name: str,
        report_root: Path | None,
        model_root: Path | None,
        valid: bool,
        reason: str | None,
    ) -> None:
        self.pbip_file = pbip_file
        self.project_name = project_name
        self.report_root = report_root
        self.model_root = model_root
        self.valid = valid
        self.reason = reason


def _unique_name(name: str, seen: set[str]) -> str:
    """Two isolated project subfolders can legitimately share a Power BI project name
    (e.g. two teams both named their project "Sales") - suffix rather than collide."""
    candidate, n = name, 2
    while candidate in seen:
        candidate = f"{name}_{n}"
        n += 1
    seen.add(candidate)
    return candidate


def discover_projects(root: Path) -> list[DiscoveredProject]:
    """Finds every `.pbip` under ``root`` and classifies each as valid (both its
    `.Report` and `.SemanticModel` folders resolve) or invalid (with a human-readable
    reason), continuing past any one project's problems rather than raising."""
    discovered: list[DiscoveredProject] = []
    seen_names: set[str] = set()

    for pbip_file in find_all_pbip_candidates(root):
        project_name = _unique_name(pbip_file.stem, seen_names)
        _project_root, report_root, model_root = resolve_pbip_roots(pbip_file)

        if report_root is None and model_root is None:
            discovered.append(
                DiscoveredProject(pbip_file, project_name, None, None, False, "Missing .Report and .SemanticModel folders")
            )
        elif report_root is None:
            discovered.append(DiscoveredProject(pbip_file, project_name, None, model_root, False, "Missing .Report folder"))
        elif model_root is None:
            discovered.append(
                DiscoveredProject(pbip_file, project_name, report_root, None, False, "Missing .SemanticModel folder")
            )
        else:
            discovered.append(DiscoveredProject(pbip_file, project_name, report_root, model_root, True, None))

    return discovered
