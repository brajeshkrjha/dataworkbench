"""Parquet Reader: upload a parquet file once, then inspect its metadata,
schema, and row data by an opaque session id without re-uploading.

Only the row groups needed for a given page are read from disk, so
pagination never has to materialize the whole file in memory. This
mirrors `conversion_service.py`'s "one small class per concern" style
and is intentionally the seam future reader capabilities (filtering,
profiling, metadata explorer, ...) will extend: they take a `file_id`
and read from the same session, no new upload plumbing required.
"""
import base64
import datetime
import decimal
import logging
import random
import time
import uuid
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pa_csv
import pyarrow.parquet as pq

from app.core.exceptions import ColumnNotFoundError, ConversionError, FileParseError, ReaderSessionNotFoundError
from app.schemas.parquet import (
    ColumnProfile,
    ColumnSchema,
    ColumnStatistics,
    ColumnStorage,
    CommonValue,
    ParquetFileMetadata,
    ParquetRowPage,
    ParquetSample,
    ParquetStatistics,
    RowGroupStorage,
    SampleMode,
    StorageAnalysis,
)
from app.utils.file_utils import delete_quietly

_SESSION_TTL_SECONDS = 30 * 60
_ROW_BATCH_SIZE = 8_192
logger = logging.getLogger(__name__)

# Above this many rows, per-column distinct-count/average (which require
# reading actual data rather than just footer stats) are skipped so the
# Statistics tab stays fast on very large files. Eligible statistics and
# profiles read one column at a time to avoid materializing wide tables.
_MAX_ROWS_FOR_FULL_STATS = 500_000
_MAX_SAMPLE_SIZE = 5_000
_MOST_COMMON_VALUES_LIMIT = 10


@dataclass
class _ReaderSession:
    path: Path
    file_name: str
    created_at: float
    active_readers: int = 0


def _json_safe(value: Any) -> Any:
    """Normalize a value read from parquet into a JSON-serializable primitive."""
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


def _stringify(value: Any) -> str | None:
    """Renders a footer/compute statistic value for display, JSON-safely."""
    if value is None:
        return None
    return str(_json_safe(value))


def _most_common_values(column_data: pa.Array | pa.ChunkedArray, limit: int) -> list[CommonValue]:
    """Top `limit` most frequent non-null values, most frequent first."""
    counts_struct = pc.value_counts(column_data)
    values = counts_struct.field("values").to_pylist()
    counts = counts_struct.field("counts").to_pylist()
    pairs = [(value, count) for value, count in zip(values, counts) if value is not None]
    pairs.sort(key=lambda pair: pair[1], reverse=True)
    return [CommonValue(value=_stringify(value), count=count) for value, count in pairs[:limit]]


class ParquetReaderService:
    """Parses uploaded parquet files and serves metadata/schema/rows by session id."""

    def __init__(self) -> None:
        self._sessions: dict[str, _ReaderSession] = {}
        # FastAPI runs synchronous routes concurrently in a worker thread pool.
        self._sessions_lock = Lock()

    def register_upload(self, path: Path, file_name: str) -> str:
        """Validate and register an uploaded parquet file, returning its session id."""
        self._evict_expired()
        try:
            # Validate via an explicit file handle (closed by the `with` block
            # even on failure) rather than handing pyarrow the path directly,
            # so a corrupt file's temp path can be deleted immediately after
            # on Windows instead of staying locked by a half-open reader.
            with path.open("rb") as handle, pq.ParquetFile(handle):
                pass
        except Exception as exc:
            delete_quietly(path)
            raise FileParseError(file_name, str(exc)) from exc

        file_id = uuid.uuid4().hex
        with self._sessions_lock:
            self._sessions[file_id] = _ReaderSession(
                path=path, file_name=file_name, created_at=time.time()
            )
        return file_id

    def get_metadata(self, file_id: str) -> ParquetFileMetadata:
        with self._open(file_id) as (session, parquet_file):
            metadata = parquet_file.metadata

            compression = None
            if metadata.num_row_groups > 0 and metadata.row_group(0).num_columns > 0:
                compression = metadata.row_group(0).column(0).compression

            return ParquetFileMetadata(
                file_name=session.file_name,
                file_size_bytes=session.path.stat().st_size,
                row_count=metadata.num_rows,
                column_count=metadata.num_columns,
                row_group_count=metadata.num_row_groups,
                compression=compression,
                created_by=metadata.created_by,
            )

    def get_schema(self, file_id: str) -> list[ColumnSchema]:
        with self._open(file_id) as (_, parquet_file):
            return [
                ColumnSchema(name=field.name, data_type=str(field.type), nullable=field.nullable)
                for field in parquet_file.schema_arrow
            ]

    def get_rows(self, file_id: str, offset: int, limit: int) -> ParquetRowPage:
        with self._open(file_id) as (_, parquet_file):
            total_rows = parquet_file.metadata.num_rows

            if offset < 0 or limit <= 0 or offset >= total_rows:
                return ParquetRowPage(rows=[], total_row_count=total_rows, offset=offset, limit=limit)

            table = self._read_range(parquet_file, offset, limit)
            rows = [{key: _json_safe(value) for key, value in row.items()} for row in table.to_pylist()]
            return ParquetRowPage(rows=rows, total_row_count=total_rows, offset=offset, limit=limit)

    # ---- Parquet Analyzer ----

    def get_statistics(self, file_id: str) -> ParquetStatistics:
        """Null counts and min/max come from the footer (free). Distinct
        counts and averages read one column at a time, only when the file
        is small enough; otherwise they are left `None` as before.
        """
        with self._open(file_id) as (_, parquet_file):
            metadata = parquet_file.metadata
            schema = parquet_file.schema_arrow
            total_rows = metadata.num_rows

            columns: list[ColumnStatistics] = []
            for col_index, field in enumerate(schema):
                null_count = 0
                min_value: Any = None
                max_value: Any = None
                for group_index in range(metadata.num_row_groups):
                    stats = metadata.row_group(group_index).column(col_index).statistics
                    if stats is None:
                        continue
                    null_count += stats.null_count or 0
                    if stats.has_min_max:
                        if min_value is None or stats.min < min_value:
                            min_value = stats.min
                        if max_value is None or stats.max > max_value:
                            max_value = stats.max

                distinct_count = None
                avg_value = None
                if total_rows <= _MAX_ROWS_FOR_FULL_STATS:
                    column_data = parquet_file.read(columns=[field.name]).column(field.name)
                    distinct_count = pc.count_distinct(column_data).as_py()
                    if pa.types.is_floating(field.type) or pa.types.is_integer(field.type):
                        mean = pc.mean(column_data).as_py()
                        avg_value = float(mean) if mean is not None else None
                    del column_data

                columns.append(
                    ColumnStatistics(
                        name=field.name,
                        data_type=str(field.type),
                        null_count=null_count,
                        null_percentage=round(100 * null_count / total_rows, 2) if total_rows else 0.0,
                        distinct_count=distinct_count,
                        min_value=_stringify(min_value),
                        max_value=_stringify(max_value),
                        avg_value=avg_value,
                    )
                )

            return ParquetStatistics(row_count=total_rows, column_count=len(schema), columns=columns)

    def get_column_profile(self, file_id: str, column_name: str) -> ColumnProfile:
        """Reads only the requested column's data (never the whole table),
        so this stays cheap even with hundreds of other columns present."""
        with self._open(file_id) as (_, parquet_file):
            schema = parquet_file.schema_arrow
            if column_name not in schema.names:
                raise ColumnNotFoundError(column_name)

            field = schema.field(column_name)
            table = parquet_file.read(columns=[column_name])
            column_data = table.column(0)
            total_rows = table.num_rows
            null_count = column_data.null_count
            non_null_count = total_rows - null_count
            distinct_count = pc.count_distinct(column_data).as_py()

            most_common = _most_common_values(column_data, _MOST_COMMON_VALUES_LIMIT)

            min_value = max_value = None
            avg_value = None
            if non_null_count > 0 and (pa.types.is_floating(field.type) or pa.types.is_integer(field.type) or pa.types.is_temporal(field.type)):
                try:
                    min_value = pc.min(column_data).as_py()
                    max_value = pc.max(column_data).as_py()
                except Exception:
                    logger.debug("Optional column min/max unavailable", exc_info=True)
            if non_null_count > 0 and (pa.types.is_floating(field.type) or pa.types.is_integer(field.type)):
                mean = pc.mean(column_data).as_py()
                avg_value = float(mean) if mean is not None else None

            return ColumnProfile(
                name=column_name,
                data_type=str(field.type),
                null_count=null_count,
                null_percentage=round(100 * null_count / total_rows, 2) if total_rows else 0.0,
                distinct_count=distinct_count,
                cardinality_ratio=round(distinct_count / non_null_count, 4) if non_null_count else 0.0,
                most_common_values=most_common,
                min_value=_stringify(min_value),
                max_value=_stringify(max_value),
                avg_value=avg_value,
            )

    def get_sample(self, file_id: str, mode: SampleMode, sample_size: int) -> ParquetSample:
        """Never reads more than one row group's worth of data for random
        sampling on large files, and only `sample_size` rows for 'first'."""
        with self._open(file_id) as (_, parquet_file):
            total_rows = parquet_file.metadata.num_rows
            sample_size = max(0, min(sample_size, _MAX_SAMPLE_SIZE, total_rows))

            if sample_size == 0:
                return ParquetSample(mode=mode, sample_size=0, rows=[])

            if mode == SampleMode.FIRST:
                table = self._read_range(parquet_file, 0, sample_size)
            elif total_rows <= _MAX_ROWS_FOR_FULL_STATS:
                full = parquet_file.read()
                indices = sorted(random.sample(range(total_rows), sample_size))
                table = full.take(pa.array(indices))
            else:
                group_index = random.randrange(parquet_file.metadata.num_row_groups)
                group_table = parquet_file.read_row_groups([group_index])
                take_n = min(sample_size, group_table.num_rows)
                local_indices = sorted(random.sample(range(group_table.num_rows), take_n))
                table = group_table.take(pa.array(local_indices))

            rows = [{key: _json_safe(value) for key, value in row.items()} for row in table.to_pylist()]
            return ParquetSample(mode=mode, sample_size=len(rows), rows=rows)

    # ---- Parquet -> CSV export (Convert Files, "From Parquet" direction) ----

    def export_to_csv(
        self,
        file_id: str,
        output_path: Path,
        delimiter: str = ",",
        include_header: bool = True,
        quoting_style: str = "needed",
    ) -> tuple[int, int]:
        """Streams the uploaded parquet file to a CSV file batch-by-batch.

        Never materializes the full table in memory - `iter_batches` reads
        one row-group-sized chunk at a time, mirroring the streaming write
        pattern `DelimitedTextConverter` uses for CSV -> parquet, just in
        reverse. Returns `(row_count, column_count)`.
        """
        with self._open(file_id) as (session, parquet_file):
            write_options = pa_csv.WriteOptions(
                include_header=include_header, delimiter=delimiter, quoting_style=quoting_style
            )
            try:
                with pa_csv.CSVWriter(
                    str(output_path), parquet_file.schema_arrow, write_options=write_options
                ) as writer:
                    for batch in parquet_file.iter_batches(batch_size=_ROW_BATCH_SIZE):
                        writer.write_batch(batch)
            except (pa.ArrowNotImplementedError, OSError, ValueError) as exc:
                raise ConversionError(session.file_name, str(exc)) from exc

            return parquet_file.metadata.num_rows, len(parquet_file.schema_arrow)

    def get_storage_analysis(self, file_id: str) -> StorageAnalysis:
        """Entirely derived from footer metadata - no data is read."""
        with self._open(file_id) as (_, parquet_file):
            metadata = parquet_file.metadata
            schema = parquet_file.schema_arrow

            compression = None
            if metadata.num_row_groups > 0 and metadata.row_group(0).num_columns > 0:
                compression = metadata.row_group(0).column(0).compression

            column_compressed = [0] * len(schema)
            column_uncompressed = [0] * len(schema)
            row_groups: list[RowGroupStorage] = []
            total_compressed = 0
            total_uncompressed = 0

            for group_index in range(metadata.num_row_groups):
                row_group = metadata.row_group(group_index)
                group_compressed = 0
                group_uncompressed = 0
                for col_index in range(row_group.num_columns):
                    col_meta = row_group.column(col_index)
                    group_compressed += col_meta.total_compressed_size
                    group_uncompressed += col_meta.total_uncompressed_size
                    column_compressed[col_index] += col_meta.total_compressed_size
                    column_uncompressed[col_index] += col_meta.total_uncompressed_size
                row_groups.append(
                    RowGroupStorage(
                        index=group_index,
                        row_count=row_group.num_rows,
                        compressed_size_bytes=group_compressed,
                        uncompressed_size_bytes=group_uncompressed,
                    )
                )
                total_compressed += group_compressed
                total_uncompressed += group_uncompressed

            columns = [
                ColumnStorage(
                    name=field.name,
                    compressed_size_bytes=column_compressed[i],
                    uncompressed_size_bytes=column_uncompressed[i],
                    compression_ratio=(
                        round(column_uncompressed[i] / column_compressed[i], 2) if column_compressed[i] else 0.0
                    ),
                )
                for i, field in enumerate(schema)
            ]

            return StorageAnalysis(
                compression=compression,
                total_compressed_bytes=total_compressed,
                total_uncompressed_bytes=total_uncompressed,
                overall_compression_ratio=(
                    round(total_uncompressed / total_compressed, 2) if total_compressed else 0.0
                ),
                row_groups=row_groups,
                columns=columns,
            )

    @contextmanager
    def _open(self, file_id: str) -> Iterator[tuple[_ReaderSession, pq.ParquetFile]]:
        with self._sessions_lock:
            session = self._sessions.get(file_id)
            if session is None:
                raise ReaderSessionNotFoundError(file_id)
            session.active_readers += 1

        try:
            with ExitStack() as stack:
                try:
                    handle = stack.enter_context(session.path.open("rb"))
                    parquet_file = stack.enter_context(pq.ParquetFile(handle))
                except Exception as exc:
                    raise FileParseError(session.file_name, str(exc)) from exc
                yield session, parquet_file
        finally:
            with self._sessions_lock:
                session.active_readers -= 1

    def _evict_expired(self) -> None:
        cutoff = time.time() - _SESSION_TTL_SECONDS
        with self._sessions_lock:
            expired = [
                file_id for file_id, session in self._sessions.items()
                if session.created_at < cutoff and session.active_readers == 0
            ]
            sessions = [self._sessions.pop(file_id) for file_id in expired]
        for session in sessions:
            delete_quietly(session.path)

    @staticmethod
    def _read_range(parquet_file: pq.ParquetFile, offset: int, limit: int) -> pa.Table:
        """Read overlapping row groups in bounded batches, retaining only the page.

        Reading whole groups then slicing retains the entire group's Arrow
        buffers, even for a 100-row page from a multi-million-row group.
        """
        needed_groups: list[int] = []
        group_start = 0
        first_group_start = 0
        for group_index in range(parquet_file.metadata.num_row_groups):
            group_rows = parquet_file.metadata.row_group(group_index).num_rows
            group_end = group_start + group_rows
            if group_end > offset and group_start < offset + limit:
                if not needed_groups:
                    first_group_start = group_start
                needed_groups.append(group_index)
            if group_end >= offset + limit:
                break
            group_start = group_end

        batches: list[pa.RecordBatch] = []
        skip = offset - first_group_start
        remaining = limit
        for batch in parquet_file.iter_batches(batch_size=_ROW_BATCH_SIZE, row_groups=needed_groups):
            if skip >= batch.num_rows:
                skip -= batch.num_rows
                continue
            take = min(remaining, batch.num_rows - skip)
            batches.append(batch.slice(skip, take))
            remaining -= take
            skip = 0
            if remaining == 0:
                break
        return pa.Table.from_batches(batches, schema=parquet_file.schema_arrow)
