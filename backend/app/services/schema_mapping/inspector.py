"""Schema discovery: sample a delimited text file and report, per
column, the auto-detected datatype, a few example values, and the
null rate within the sample - so the Convert Files UI can show users
what will happen before they commit to a conversion, and let them
override individual columns.

Only reads a bounded sample (`_SAMPLE_ROWS`), never the whole file, so
inspection stays cheap even for very large uploads. Null percentage and
sample values are therefore "practical" (based on the sample), not an
exact full-file scan - acceptable for a pre-conversion preview.
"""
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.csv as pa_csv

from app.core.exceptions import FileParseError
from app.schemas.parquet import SchemaFieldInfo, SchemaInspectionResult
from app.services.schema_mapping.types import from_arrow_type

_READ_BLOCK_SIZE = 1024 * 1024
_SAMPLE_ROWS = 500
_MAX_SAMPLE_VALUES = 3
_MAX_PREVIEW_ROWS = 5


def inspect_delimited_text(source_path: Path, source_name: str, delimiter: str) -> SchemaInspectionResult:
    """Sample a CSV/TSV file and report detected per-column datatypes."""
    try:
        reader = pa_csv.open_csv(
            source_path,
            read_options=pa_csv.ReadOptions(block_size=_READ_BLOCK_SIZE),
            parse_options=pa_csv.ParseOptions(delimiter=delimiter),
        )
    except pa.ArrowInvalid as exc:
        raise FileParseError(source_name, str(exc)) from exc

    batches: list[pa.RecordBatch] = []
    rows_collected = 0
    try:
        schema = reader.schema
        for batch in reader:
            batches.append(batch)
            rows_collected += batch.num_rows
            if rows_collected >= _SAMPLE_ROWS:
                break
    except pa.ArrowInvalid as exc:
        raise FileParseError(source_name, str(exc)) from exc
    finally:
        reader.close()

    if not batches:
        # Header-only file: no data rows to sample, but columns still exist.
        fields = [
            SchemaFieldInfo(
                name=field.name,
                detected_type=from_arrow_type(field.type),
                sample_values=[],
                null_percentage=0.0,
            )
            for field in schema
        ]
        return SchemaInspectionResult(
            file_name=source_name, row_sample_count=0, fields=fields, preview_rows=[]
        )

    table = pa.Table.from_batches(batches, schema=schema)
    total_rows = table.num_rows

    fields = []
    for field in schema:
        column = table.column(field.name)
        null_count = column.null_count
        null_percentage = round((null_count / total_rows) * 100, 2) if total_rows else 0.0
        samples: list[str] = []
        for value in column.to_pylist():
            if value is None:
                continue
            samples.append(str(value))
            if len(samples) >= _MAX_SAMPLE_VALUES:
                break
        fields.append(
            SchemaFieldInfo(
                name=field.name,
                detected_type=from_arrow_type(field.type),
                sample_values=samples,
                null_percentage=null_percentage,
            )
        )

    preview_rows: list[dict[str, Any]] = table.slice(0, _MAX_PREVIEW_ROWS).to_pylist()

    return SchemaInspectionResult(
        file_name=source_name,
        row_sample_count=total_rows,
        fields=fields,
        preview_rows=preview_rows,
    )
