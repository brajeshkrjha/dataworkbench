"""Generic file-related helper utilities."""
import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import BinaryIO

_UNSAFE_NAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_CHUNK_SIZE = 1024 * 1024


def format_bytes(size_bytes: int) -> str:
    """Format a byte count into a human-readable string (e.g. '1.5 MB')."""
    size = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"


def get_extension(file_name: str) -> str:
    """Return the lower-cased extension of a file name, without the dot."""
    return Path(file_name).suffix.lstrip(".").lower()


def sanitize_file_name(file_name: str, fallback: str) -> str:
    """Strip path components and unsafe characters from a file name.

    Prevents path traversal from user-supplied names and keeps the
    result safe to use in a Content-Disposition header.
    """
    base = Path(file_name.replace("\\", "/")).name
    cleaned = _UNSAFE_NAME_CHARS.sub("_", base).strip("._")
    return cleaned or fallback


def spool_to_temp_file(source: BinaryIO, suffix: str = "") -> tuple[Path, int]:
    """Copy a binary stream to a temporary file on disk in chunks.

    Keeps memory usage flat for large uploads. The caller owns the
    returned path and is responsible for deleting it.
    """
    path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            path = Path(temp_file.name)
            shutil.copyfileobj(source, temp_file, _CHUNK_SIZE)
        return path, path.stat().st_size
    except BaseException:
        # Ownership passes to the caller only on success. Close the handle
        # before unlinking partial uploads, including on Windows.
        if path is not None:
            delete_quietly(path)
        raise


def create_temp_file(suffix: str = "") -> Path:
    """Create an empty temporary file and release the OS handle.

    The handle must be closed so the file can later be reopened and
    deleted on Windows. The caller owns the returned path.
    """
    handle, name = tempfile.mkstemp(suffix=suffix)
    os.close(handle)
    return Path(name)


def delete_quietly(path: Path) -> None:
    """Delete a file, ignoring the case where it is already gone."""
    path.unlink(missing_ok=True)
