"""End-to-end PBIP -> LookML conversion pipeline.

Orchestrates the ported parsing/generation modules against an
extracted PBIP project directory and produces an in-memory LookML
package ZIP. This is the only genuinely new module in the port - the
desktop tool drove the same steps from a Tkinter button handler with
disk paths chosen via a file picker.
"""
import io
import logging
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

from app.core.exceptions import (
    InvalidZipError,
    LookerGenerationError,
    MissingPbipFileError,
    MissingReportFolderError,
    MissingSemanticModelFolderError,
)
from app.services.looker.file_resolution import resolve_pbip_roots
from app.services.looker.lookml_builder import build_lookml_model
from app.services.looker.lookml_packager import build_lookml_package_name, build_lookml_zip
from app.services.looker.model_parser import parse_model
from app.services.looker.report_parser import parse_report
from app.services.looker.usage_analysis import build_clean_views

logger = logging.getLogger(__name__)

# Archive junk that must never be mistaken for project content: macOS adds a
# parallel __MACOSX tree of "._Name" resource-fork stubs when zipping, and
# "._Sales.pbip" would otherwise look like a perfectly good candidate.
_JUNK_DIR_NAMES = {"__MACOSX"}


def _find_pbip_candidates(project_root: Path) -> list[Path]:
    """Every plausible .pbip in the extracted archive, shallowest first.

    Matching on ``suffix.lower()`` rather than globbing ``*.pbip`` keeps the
    behaviour identical on Windows and Linux (pathlib's glob is
    case-insensitive only on Windows). Ordering by depth means a project
    sitting at the archive root wins over a nested copy or backup folder.
    """
    candidates = [
        path
        for path in project_root.rglob("*")
        if path.is_file()
        and path.suffix.lower() == ".pbip"
        and not path.name.startswith("._")
        and _JUNK_DIR_NAMES.isdisjoint(path.parts)
    ]
    return sorted(
        candidates,
        key=lambda path: (len(path.relative_to(project_root).parts), str(path).lower()),
    )


def find_all_pbip_candidates(project_root: Path) -> list[Path]:
    """Public wrapper around :func:`_find_pbip_candidates` for callers (bulk discovery)
    that need every `.pbip` in a tree rather than just the first one that resolves."""
    return _find_pbip_candidates(project_root)


def _resolve_project(project_root: Path) -> tuple[Path, Path, Path]:
    """Find the PBIP project inside an extracted archive.

    Nothing here depends on the uploaded archive's name or on the name of any
    folder wrapping the project: the .pbip is located wherever it happens to
    sit, and its ``<Name>.Report`` / ``<Name>.SemanticModel`` siblings are then
    resolved exactly as the desktop tool does for a local file. When an archive
    holds several .pbip files, the first one that fully resolves wins rather
    than blindly taking the alphabetically first.
    """
    candidates = _find_pbip_candidates(project_root)
    if not candidates:
        raise MissingPbipFileError()

    for pbip_file in candidates:
        _root, report_root, model_root = resolve_pbip_roots(pbip_file)
        if report_root is not None and model_root is not None:
            return pbip_file, report_root, model_root

    # Nothing resolved fully - report against the most likely candidate so the
    # error names the project the user actually meant.
    pbip_file = candidates[0]
    _root, report_root, _model_root = resolve_pbip_roots(pbip_file)
    if report_root is None:
        raise MissingReportFolderError(pbip_file.stem)
    raise MissingSemanticModelFolderError(pbip_file.stem)


def parse_pbip_upload(upload_bytes: bytes, upload_name: str) -> tuple[Path, dict, dict, dict]:
    """Extract and parse an uploaded PBIP project ZIP.

    Returns ``(pbip_file, report_data, model_data, clean_views)``. This is the
    shared first half of the pipeline: every GCP Looker Utility module
    (convert, explore, preview, compare) needs the same extraction + parsing
    step, so it lives here once rather than being duplicated per module.
    Note the returned ``pbip_file`` Path only remains useful for its
    ``.stem``/``.name`` - the temp directory it points into is gone once this
    function returns.
    """
    with TemporaryDirectory(prefix="looker-pbip-") as tmp_dir:
        extract_root = Path(tmp_dir) / "project"
        extract_root.mkdir(parents=True, exist_ok=True)

        try:
            with zipfile.ZipFile(io.BytesIO(upload_bytes)) as zf:
                zf.extractall(extract_root)
        except zipfile.BadZipFile as exc:
            raise InvalidZipError(upload_name) from exc

        pbip_file, report_root, model_root = _resolve_project(extract_root)

        try:
            report_data = parse_report(report_root)
            model_data = parse_model(model_root)
            clean_views = build_clean_views(report_data, model_data)
        except (InvalidZipError, MissingPbipFileError, MissingReportFolderError, MissingSemanticModelFolderError):
            raise
        except Exception as exc:
            logger.exception("PBIP parsing failed")
            raise LookerGenerationError(str(exc)) from exc

        return pbip_file, report_data, model_data, clean_views


def convert_pbip_to_lookml(upload_bytes: bytes, upload_name: str) -> dict:
    """Convert an uploaded PBIP project ZIP into a LookML package ZIP.

    Returns a dict with the LookML package bytes plus summary counts,
    ready to hand straight to an HTTP response.
    """
    pbip_file, _report_data, model_data, clean_views = parse_pbip_upload(upload_bytes, upload_name)

    try:
        model_text, counts, views = build_lookml_model(pbip_file, model_data, clean_views)
    except Exception as exc:
        logger.exception("LookML generation failed")
        raise LookerGenerationError(str(exc)) from exc

    zip_bytes, package_name = build_lookml_zip(pbip_file.stem, model_text, views)

    relationships_df = clean_views.get("relationships")
    measures_df = clean_views.get("measures_used")

    return {
        "project_name": pbip_file.stem,
        "package_name": package_name,
        "output_file_name": f"{build_lookml_package_name(pbip_file)}.zip",
        "views_generated": counts.get("views", 0),
        "explores_generated": counts.get("explores", 0),
        "relationships_found": 0 if relationships_df is None else len(relationships_df),
        "measures_found": 0 if measures_df is None else len(measures_df),
        "zip_bytes": zip_bytes,
    }
