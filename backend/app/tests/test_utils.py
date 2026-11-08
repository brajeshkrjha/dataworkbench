"""Tests for reusable utility functions."""
import io
from pathlib import Path

import pytest

from app.utils import file_utils
from app.utils.file_utils import format_bytes, spool_to_temp_file


def test_format_bytes_handles_various_sizes() -> None:
    assert format_bytes(0) == "0 B"
    assert format_bytes(1023) == "1023 B"
    assert format_bytes(1024) == "1.0 KB"
    assert format_bytes(1024 * 1024) == "1.0 MB"


def test_spool_preserves_content_and_transfers_file_ownership(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(file_utils.tempfile, "tempdir", str(tmp_path))
    content = b"file contents" * 100_000
    path, size = spool_to_temp_file(io.BytesIO(content), suffix=".parquet")

    assert path.suffix == ".parquet"
    assert size == len(content)
    assert path.read_bytes() == content
    path.unlink()  # Verifies the handle is already closed on Windows.


def test_spool_deletes_partial_file_when_reading_fails(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(file_utils.tempfile, "tempdir", str(tmp_path))

    class BrokenUpload(io.BytesIO):
        def read(self, size=-1):
            if self.tell():
                raise OSError("Upload interrupted")
            return super().read(size)

    with pytest.raises(OSError, match="Upload interrupted"):
        spool_to_temp_file(BrokenUpload(b"partial content"))
    assert list(tmp_path.iterdir()) == []


def test_spool_deletes_file_when_stat_fails(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(file_utils.tempfile, "tempdir", str(tmp_path))

    def fail_stat(self, *args, **kwargs):
        raise OSError("Stat failed")

    with monkeypatch.context() as patch:
        patch.setattr(Path, "stat", fail_stat)
        with pytest.raises(OSError, match="Stat failed"):
            spool_to_temp_file(io.BytesIO(b"content"))
    assert list(tmp_path.iterdir()) == []
