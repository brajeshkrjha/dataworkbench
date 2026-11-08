"""Regression coverage for shared validation and temporary-file ownership."""
import io

import pytest
from fastapi import UploadFile

from app.api.routers import parquet
from app.core.config import Settings
from app.core.exceptions import EmptyFileError, FileTooLargeError, UnsupportedFileTypeError
from app.services.parquet.conversion_service import ParquetConversionService
from app.services.parquet.reader_service import ParquetReaderService


@pytest.mark.parametrize("upload", [parquet.upload_for_reading, parquet.upload_for_analysis])
@pytest.mark.parametrize(
    ("name", "content", "error"),
    [("data.csv", b"a,b", UnsupportedFileTypeError),
     ("empty.parquet", b"", EmptyFileError),
     ("large.parquet", b"12345", FileTooLargeError)],
)
def test_reader_and_analyzer_share_validation(upload, name, content, error, tmp_path, monkeypatch):
    monkeypatch.setattr("app.utils.file_utils.tempfile.tempdir", str(tmp_path))
    with pytest.raises(error):
        upload(
            file=UploadFile(filename=name, file=io.BytesIO(content)),
            service=ParquetReaderService(),
            settings=Settings(max_upload_bytes=4),
        )
    assert list(tmp_path.iterdir()) == []


def test_conversion_cleans_source_if_output_allocation_fails(tmp_path, monkeypatch):
    monkeypatch.setattr("app.utils.file_utils.tempfile.tempdir", str(tmp_path))

    def fail_allocation(*args, **kwargs):
        raise OSError("No space left")

    monkeypatch.setattr(parquet, "create_temp_file", fail_allocation)
    with pytest.raises(OSError, match="No space left"):
        parquet.convert_to_parquet(
            file=UploadFile(filename="data.csv", file=io.BytesIO(b"id\n1\n")),
            output_file_name=None,
            service=ParquetConversionService(),
            settings=Settings(),
        )
    assert list(tmp_path.iterdir()) == []