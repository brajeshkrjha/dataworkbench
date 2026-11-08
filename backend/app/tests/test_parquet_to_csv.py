"""Tests for the Parquet -> CSV export endpoints (Convert Files, "From Parquet")."""
import io
import re

import pyarrow as pa
import pyarrow.parquet as pq
from fastapi.testclient import TestClient

UPLOAD_URL = "/api/v1/tools/parquet-utility/convert/from-parquet/upload"
READER_UPLOAD_URL = "/api/v1/tools/parquet-utility/reader/upload"

TIMESTAMPED_CSV_NAME = re.compile(r"^people_\d{8}_\d{6}\.csv$")


def _build_parquet_bytes(num_rows: int = 3) -> bytes:
    table = pa.table(
        {
            "id": list(range(1, num_rows + 1)),
            "name": [f"person_{i}" for i in range(1, num_rows + 1)],
            "score": [float(i) + 0.5 for i in range(1, num_rows + 1)],
        }
    )
    buffer = pa.BufferOutputStream()
    pq.write_table(table, buffer, compression="snappy")
    return buffer.getvalue().to_pybytes()


def _build_empty_parquet_bytes() -> bytes:
    schema = pa.schema([("id", pa.int64()), ("name", pa.string())])
    table = pa.Table.from_pylist([], schema=schema)
    buffer = pa.BufferOutputStream()
    pq.write_table(table, buffer)
    return buffer.getvalue().to_pybytes()


PARQUET_CONTENT = _build_parquet_bytes(3)


def _upload(client: TestClient, content: bytes = PARQUET_CONTENT, name: str = "people.parquet") -> str:
    response = client.post(UPLOAD_URL, files={"file": (name, content, "application/octet-stream")})
    assert response.status_code == 200
    return response.json()["file_id"]


def _export_url(file_id: str) -> str:
    return f"/api/v1/tools/parquet-utility/convert/from-parquet/{file_id}/export"


def test_upload_valid_parquet_for_csv_export(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL, files={"file": ("people.parquet", PARQUET_CONTENT, "application/octet-stream")}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["file_id"]
    assert body["metadata"]["row_count"] == 3
    assert body["metadata"]["column_count"] == 3
    assert {col["name"] for col in body["columns"]} == {"id", "name", "score"}


def test_upload_rejects_non_parquet_file(client: TestClient) -> None:
    response = client.post(UPLOAD_URL, files={"file": ("people.csv", b"id,name\n1,alice\n", "text/csv")})

    assert response.status_code == 400
    assert response.json()["error"] == "UnsupportedFileTypeError"


def test_upload_rejects_empty_file(client: TestClient) -> None:
    response = client.post(UPLOAD_URL, files={"file": ("empty.parquet", b"", "application/octet-stream")})

    assert response.status_code == 400
    assert response.json()["error"] == "EmptyFileError"


def test_upload_rejects_invalid_parquet_bytes(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL, files={"file": ("broken.parquet", b"not a parquet file", "application/octet-stream")}
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_export_default_options(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id))

    assert response.status_code == 200
    assert response.headers["x-conversion-row-count"] == "3"
    assert response.headers["x-conversion-column-count"] == "3"
    assert TIMESTAMPED_CSV_NAME.match(response.headers["x-conversion-file-name"])
    text = response.content.decode()
    assert text.splitlines()[0].split(",") == ['"id"', '"name"', '"score"']


def test_export_with_pipe_delimiter(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"delimiter": "pipe"})

    assert response.status_code == 200
    first_line = response.content.decode().splitlines()[0]
    assert "|" in first_line
    assert "," not in first_line


def test_export_with_tab_delimiter(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"delimiter": "tab"})

    assert response.status_code == 200
    assert "\t" in response.content.decode().splitlines()[0]


def test_export_with_semicolon_delimiter(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"delimiter": "semicolon"})

    assert response.status_code == 200
    assert ";" in response.content.decode().splitlines()[0]


def test_export_without_header(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"include_header": "false"})

    assert response.status_code == 200
    lines = response.content.decode().splitlines()
    assert len(lines) == 3  # 3 data rows, no header
    assert "id" not in lines[0].lower() or lines[0][0].isdigit() or lines[0].startswith("1")


def test_export_with_minimal_quoting(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"quoting": "minimal"})

    assert response.status_code == 200
    lines = response.content.decode().splitlines()
    # pyarrow's CSV writer always quotes the header row; "minimal" quoting is
    # reflected in the data rows, which is what users actually export/consume.
    assert '"' not in lines[1]


def test_export_with_custom_filename(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id), data={"output_file_name": "my_export"})

    assert response.status_code == 200
    assert response.headers["x-conversion-file-name"] == "my_export.csv"


def test_export_default_filename_has_timestamp(client: TestClient) -> None:
    file_id = _upload(client)

    response = client.post(_export_url(file_id))

    assert TIMESTAMPED_CSV_NAME.match(response.headers["x-conversion-file-name"])


def test_export_empty_parquet_file_produces_header_only(client: TestClient) -> None:
    file_id = _upload(client, _build_empty_parquet_bytes(), "empty_data.parquet")

    response = client.post(_export_url(file_id))

    assert response.status_code == 200
    assert response.headers["x-conversion-row-count"] == "0"
    lines = response.content.decode().splitlines()
    assert len(lines) == 1  # header only


def test_export_unknown_session_returns_404(client: TestClient) -> None:
    response = client.post(_export_url("does-not-exist"))

    assert response.status_code == 404
    assert response.json()["error"] == "ReaderSessionNotFoundError"


def test_export_large_dataset_streams_without_error(client: TestClient) -> None:
    file_id = _upload(client, _build_parquet_bytes(50_000), "large.parquet")

    response = client.post(_export_url(file_id))

    assert response.status_code == 200
    assert response.headers["x-conversion-row-count"] == "50000"
    lines = response.content.decode().splitlines()
    assert len(lines) == 50_001  # header + 50k rows


def test_file_id_reusable_in_parquet_reader(client: TestClient) -> None:
    """The upload session is shared with Parquet Reader: the same file_id
    returned here can be used against `/reader/{file_id}/...` directly,
    so "Open in Parquet Reader" needs no re-upload."""
    file_id = _upload(client)

    response = client.get(f"/api/v1/tools/parquet-utility/reader/{file_id}/rows", params={"offset": 0, "limit": 2})

    assert response.status_code == 200
    assert len(response.json()["rows"]) == 2
