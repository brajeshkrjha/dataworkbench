"""Detects whether an uploaded ZIP is a PBIP project or a generated LookML package.

Used by the Compare LookML Packages module so a user never has to tell the
tool what kind of file they're uploading on either side of a comparison.
"""
import io
import zipfile

from app.core.exceptions import InvalidZipError, UnrecognizedSourceTypeError

SOURCE_TYPE_PBIP = "pbip_project"
SOURCE_TYPE_LOOKML = "lookml_package"


def _entry_basename(name: str) -> str:
    return name.rsplit("/", 1)[-1]


def detect_source_type(upload_bytes: bytes, upload_name: str) -> str:
    """Classify a ZIP as a PBIP project or a LookML package from its entry names alone.

    A PBIP project ZIP contains a ``.pbip`` file (plus its Report/SemanticModel
    folders); a LookML package ZIP contains ``.lkml`` files (a model file plus
    ``views/*.view.lkml``) and no ``.pbip`` file. Detection only needs the
    archive's file listing, not full extraction/parsing.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(upload_bytes)) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
    except zipfile.BadZipFile as exc:
        raise InvalidZipError(upload_name) from exc

    has_pbip = any(
        name.lower().endswith(".pbip") and not _entry_basename(name).startswith("._") for name in names
    )
    if has_pbip:
        return SOURCE_TYPE_PBIP

    has_lkml = any(name.lower().endswith(".lkml") and not _entry_basename(name).startswith("._") for name in names)
    if has_lkml:
        return SOURCE_TYPE_LOOKML

    raise UnrecognizedSourceTypeError(upload_name)
