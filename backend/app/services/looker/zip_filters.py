"""Shared rules for extracting uploaded PBIP ZIP archives safely.

Both the single-project and bulk paths use these so a Power BI Desktop cache
(`.pbi/cache.abf`, often hundreds of MB and never read by the converter) is never
extracted, and a decompression bomb is rejected before anything is written.
"""
import zipfile
from pathlib import Path

from app.core.exceptions import FileTooLargeError

# Limits apply to what would actually be extracted (after skipping cache/junk).
MAX_EXTRACTED_BYTES = 1024 * 1024 * 1024
MAX_EXTRACTED_FILES = 50_000

_SKIP_SUFFIXES = (".ds_store", "thumbs.db")


def should_skip_zip_entry(name: str) -> bool:
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


def extractable_members(zf: zipfile.ZipFile, upload_name: str) -> list[zipfile.ZipInfo]:
    """Entries worth extracting; raises FileTooLargeError if they exceed the limits."""
    members = [
        info
        for info in zf.infolist()
        if not info.is_dir() and not should_skip_zip_entry(info.filename)
    ]
    total = sum(info.file_size for info in members)
    if len(members) > MAX_EXTRACTED_FILES or total > MAX_EXTRACTED_BYTES:
        raise FileTooLargeError(upload_name, MAX_EXTRACTED_BYTES)
    return members
