"""Tests for the Parquet Reader endpoints."""

import pyarrow as pa
import pyarrow.parquet as pq
from fastapi.testclient import TestClient

UPLOAD_URL = "/api/v1/tools/parquet-utility/reader/upload"


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


PARQUET_CONTENT = _build_parquet_bytes(3)


def _upload(client: TestClient, content: bytes = PARQUET_CONTENT, name: str = "people.parquet"):
    return client.post(UPLOAD_URL, files={"file": (name, content, "application/octet-stream")})


def test_upload_valid_parquet_returns_metadata_and_schema(client: TestClient) -> None:
    response = _upload(client)

    assert response.status_code == 200
    body = response.json()
    assert body["file_id"]
    assert body["metadata"]["file_name"] == "people.parquet"
    assert body["metadata"]["row_count"] == 3
    assert body["metadata"]["column_count"] == 3
    assert body["metadata"]["row_group_count"] >= 1
    assert body["metadata"]["compression"].lower() == "snappy"
    assert {col["name"] for col in body["columns"]} == {"id", "name", "score"}
    assert all("data_type" in col and "nullable" in col for col in body["columns"])


def test_get_metadata_by_session_id(client: TestClient) -> None:
    file_id = _upload(client).json()["file_id"]

    response = client.get(f"/api/v1/tools/parquet-utility/reader/{file_id}/metadata")

    assert response.status_code == 200
    assert response.json()["row_count"] == 3


def test_get_schema_by_session_id(client: TestClient) -> None:
    file_id = _upload(client).json()["file_id"]

    response = client.get(f"/api/v1/tools/parquet-utility/reader/{file_id}/schema")

    assert response.status_code == 200
    names = {col["name"] for col in response.json()}
    assert names == {"id", "name", "score"}


def test_get_rows_paginates(client: TestClient) -> None:
    file_id = _upload(client, _build_parquet_bytes(10), "big.parquet").json()["file_id"]

    first_page = client.get(
        f"/api/v1/tools/parquet-utility/reader/{file_id}/rows", params={"offset": 0, "limit": 4}
    )
    second_page = client.get(
        f"/api/v1/tools/parquet-utility/reader/{file_id}/rows", params={"offset": 4, "limit": 4}
    )

    assert first_page.status_code == 200
    first_body = first_page.json()
    assert first_body["total_row_count"] == 10
    assert [row["id"] for row in first_body["rows"]] == [1, 2, 3, 4]

    second_body = second_page.json()
    assert [row["id"] for row in second_body["rows"]] == [5, 6, 7, 8]


def test_get_rows_beyond_end_returns_empty(client: TestClient) -> None:
    file_id = _upload(client).json()["file_id"]

    response = client.get(
        f"/api/v1/tools/parquet-utility/reader/{file_id}/rows", params={"offset": 100, "limit": 10}
    )

    assert response.status_code == 200
    assert response.json()["rows"] == []
    assert response.json()["total_row_count"] == 3


def test_upload_rejects_non_parquet_file(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL, files={"file": ("data.csv", b"id,name\n1,alice\n", "text/csv")}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "UnsupportedFileTypeError"


def test_upload_rejects_empty_file(client: TestClient) -> None:
    response = _upload(client, b"", "empty.parquet")

    assert response.status_code == 400
    assert response.json()["error"] == "EmptyFileError"


def test_upload_rejects_corrupted_parquet_file(client: TestClient) -> None:
    response = _upload(client, b"not a real parquet file", "corrupt.parquet")

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_unknown_session_id_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/tools/parquet-utility/reader/does-not-exist/metadata")

    assert response.status_code == 404
    assert response.json()["error"] == "ReaderSessionNotFoundError"
