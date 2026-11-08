"""Regression tests for bounded reads, explicit handles, and concurrent sessions."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from app.core.exceptions import FileParseError, ReaderSessionNotFoundError
from app.schemas.parquet import SampleMode
from app.services.parquet import reader_service
from app.services.parquet.reader_service import ParquetReaderService
from app.services.parquet.schema_comparison_service import ParquetSchemaComparisonService


@pytest.fixture
def parquet_path(tmp_path: Path) -> Path:
    path = tmp_path / "data.parquet"
    pq.write_table(pa.table({"id": range(25), "name": [f"row-{i}" for i in range(25)]}), path, row_group_size=7)
    return path


@pytest.mark.parametrize(("offset", "limit"), [(0, 5), (6, 5), (7, 14), (22, 10)])
def test_pages_preserve_values_across_row_groups(parquet_path, offset, limit):
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    page = service.get_rows(file_id, offset, limit)

    assert page.rows == [{"id": i, "name": f"row-{i}"} for i in range(offset, min(offset + limit, 25))]
    assert page.total_row_count == 25
    assert (page.offset, page.limit) == (offset, limit)


def test_large_row_group_is_read_in_bounded_batches(tmp_path, monkeypatch):
    path = tmp_path / "wide-group.parquet"
    pq.write_table(pa.table({"id": range(50_000)}), path, row_group_size=50_000)
    service = ParquetReaderService()
    file_id = service.register_upload(path, path.name)
    original = pq.ParquetFile.iter_batches
    emitted = []

    def tracked_batches(self, *args, **kwargs):
        for batch in original(self, *args, **kwargs):
            emitted.append(batch.num_rows)
            yield batch

    def fail_full_group(*args, **kwargs):
        pytest.fail("Pagination must not materialize a whole row group")

    monkeypatch.setattr(pq.ParquetFile, "iter_batches", tracked_batches)
    monkeypatch.setattr(pq.ParquetFile, "read_row_groups", fail_full_group)
    page = service.get_rows(file_id, 0, 100)
    assert [row["id"] for row in page.rows] == list(range(100))
    assert emitted == [reader_service._ROW_BATCH_SIZE]

    emitted.clear()
    page = service.get_rows(file_id, 8_190, 5)
    assert [row["id"] for row in page.rows] == list(range(8_190, 8_195))
    assert emitted == [reader_service._ROW_BATCH_SIZE] * 2


def test_statistics_read_one_column_at_a_time(parquet_path, monkeypatch):
    original = pq.ParquetFile.read
    reads = []

    def tracked_read(self, columns=None, **kwargs):
        reads.append(columns)
        assert columns is not None and len(columns) == 1
        return original(self, columns=columns, **kwargs)

    monkeypatch.setattr(pq.ParquetFile, "read", tracked_read)
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    stats = service.get_statistics(file_id)
    assert reads == [["id"], ["name"]]
    assert stats.columns[0].distinct_count == 25
    assert stats.columns[0].avg_value == 12.0
    assert stats.columns[1].distinct_count == 25


def test_large_file_statistics_still_use_only_footer(parquet_path, monkeypatch):
    monkeypatch.setattr(reader_service, "_MAX_ROWS_FOR_FULL_STATS", 10)

    def fail_data_read(*args, **kwargs):
        pytest.fail("Large file statistics must remain footer-only")

    monkeypatch.setattr(pq.ParquetFile, "read", fail_data_read)
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    stats = service.get_statistics(file_id)
    assert all(column.distinct_count is None and column.avg_value is None for column in stats.columns)
    assert stats.columns[0].min_value == "0"
    assert stats.columns[0].max_value == "24"


def test_all_reader_operations_close_their_handles(parquet_path, monkeypatch):
    original = pq.ParquetFile
    handles = []

    def tracked_open(handle, *args, **kwargs):
        assert hasattr(handle, "close"), "Use explicit handles, including for corrupt files"
        handles.append(handle)
        return original(handle, *args, **kwargs)

    monkeypatch.setattr(pq, "ParquetFile", tracked_open)
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    operations = [
        lambda: service.get_metadata(file_id), lambda: service.get_schema(file_id),
        lambda: service.get_rows(file_id, 0, 10), lambda: service.get_statistics(file_id),
        lambda: service.get_column_profile(file_id, "id"),
        lambda: service.get_sample(file_id, SampleMode.FIRST, 10),
        lambda: service.get_storage_analysis(file_id),
    ]
    for operation in operations:
        operation()
        assert all(handle.closed for handle in handles)
    assert len(handles) == len(operations) + 1
    parquet_path.unlink()


def test_failed_read_releases_the_session_and_file(parquet_path, monkeypatch):
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)

    def fail_read(*args, **kwargs):
        raise RuntimeError("Read failed")

    monkeypatch.setattr(service, "_read_range", fail_read)
    with pytest.raises(RuntimeError, match="Read failed"):
        service.get_rows(file_id, 0, 10)
    assert service._sessions[file_id].active_readers == 0
    parquet_path.unlink()


def test_corrupt_session_can_be_deleted_even_with_retained_exception(parquet_path):
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    parquet_path.write_bytes(b"corrupt")
    with pytest.raises(FileParseError) as error:
        service.get_metadata(file_id)
    parquet_path.unlink()
    assert error.value is not None
    assert service._sessions[file_id].active_readers == 0


def test_expiration_does_not_delete_active_reads_or_serialize_io(parquet_path):
    service = ParquetReaderService()
    file_id = service.register_upload(parquet_path, parquet_path.name)
    service._sessions[file_id].created_at -= reader_service._SESSION_TTL_SECONDS + 1

    with service._open(file_id) as (_, reader), ThreadPoolExecutor(max_workers=2) as executor:
        # Eviction runs in another request thread while this handle is open.
        executor.submit(service._evict_expired).result(timeout=5)
        assert parquet_path.exists()
        assert reader.read().num_rows == 25
        assert executor.submit(service.get_metadata, file_id).result(timeout=5).row_count == 25

    service._evict_expired()
    assert not parquet_path.exists()
    with pytest.raises(ReaderSessionNotFoundError):
        service.get_metadata(file_id)


def test_concurrent_uploads_and_evictions_leave_sessions_isolated(tmp_path):
    service = ParquetReaderService()
    paths = [tmp_path / f"upload-{i}.parquet" for i in range(20)]
    for i, path in enumerate(paths):
        pq.write_table(pa.table({"id": [i]}), path)

    def upload_and_read(path):
        file_id = service.register_upload(path, path.name)
        return file_id, service.get_rows(file_id, 0, 1).rows[0]["id"]

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(upload_and_read, paths))
        assert len({file_id for file_id, _ in results}) == 20
        assert [value for _, value in results] == list(range(20))
        for session in service._sessions.values():
            session.created_at -= reader_service._SESSION_TTL_SECONDS + 1
        futures = [executor.submit(service._evict_expired) for _ in range(8)]
        for future in futures:
            future.result(timeout=5)
    assert not service._sessions
    assert not any(path.exists() for path in paths)


def test_comparison_closes_first_file_before_second_file_fails(parquet_path, tmp_path):
    corrupt = tmp_path / "corrupt.parquet"
    corrupt.write_bytes(b"not parquet")
    with pytest.raises(FileParseError) as error:
        ParquetSchemaComparisonService().compare(parquet_path, parquet_path.name, corrupt, corrupt.name)
    parquet_path.unlink()
    corrupt.unlink()
    assert error.value is not None