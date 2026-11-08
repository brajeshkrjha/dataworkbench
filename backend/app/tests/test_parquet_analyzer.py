"""Tests for the Parquet Analyzer endpoints (Overview/Schema/Statistics/
Profiling/Sampling/Storage tabs, all backed by one uploaded-file session)."""
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi.testclient import TestClient

UPLOAD_URL = "/api/v1/tools/parquet-utility/analyzer/upload"


def _build_parquet_bytes(num_rows: int = 20) -> bytes:
    table = pa.table(
        {
            "id": list(range(1, num_rows + 1)),
            "name": [f"person_{i % 5}" for i in range(1, num_rows + 1)],
            "score": [float(i) + 0.5 for i in range(1, num_rows + 1)],
            "is_active": [i % 2 == 0 for i in range(1, num_rows + 1)],
            "notes": [None if i % 4 == 0 else f"note-{i}" for i in range(1, num_rows + 1)],
        }
    )
    buffer = pa.BufferOutputStream()
    pq.write_table(table, buffer, compression="snappy", row_group_size=8)
    return buffer.getvalue().to_pybytes()


PARQUET_CONTENT = _build_parquet_bytes(20)


def _upload(client: TestClient, content: bytes = PARQUET_CONTENT, name: str = "people.parquet"):
    return client.post(UPLOAD_URL, files={"file": (name, content, "application/octet-stream")})


def _uploaded_file_id(client: TestClient) -> str:
    return _upload(client).json()["file_id"]


def test_upload_for_analysis_returns_metadata_and_schema(client: TestClient) -> None:
    response = _upload(client)

    assert response.status_code == 200
    body = response.json()
    assert body["file_id"]
    assert body["metadata"]["row_count"] == 20
    assert body["metadata"]["column_count"] == 5
    assert {col["name"] for col in body["columns"]} == {"id", "name", "score", "is_active", "notes"}


def test_analyzer_overview(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["row_count"] == 20
    assert body["row_group_count"] >= 1
    assert body["compression"].lower() == "snappy"


def test_analyzer_schema(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/schema")

    assert response.status_code == 200
    names = {col["name"] for col in response.json()}
    assert names == {"id", "name", "score", "is_active", "notes"}


def test_analyzer_statistics(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/statistics")

    assert response.status_code == 200
    body = response.json()
    assert body["row_count"] == 20
    assert body["column_count"] == 5
    columns_by_name = {col["name"]: col for col in body["columns"]}

    notes_col = columns_by_name["notes"]
    assert notes_col["null_count"] == 5  # every 4th of 20 rows
    assert notes_col["null_percentage"] == 25.0

    score_col = columns_by_name["score"]
    assert score_col["min_value"] is not None
    assert score_col["max_value"] is not None
    assert score_col["avg_value"] is not None
    assert score_col["distinct_count"] == 20


def test_analyzer_column_profile(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/columns/name/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "name"
    assert body["distinct_count"] == 5  # person_0..person_4 cycling
    assert body["null_count"] == 0
    assert 0 < body["cardinality_ratio"] <= 1
    assert len(body["most_common_values"]) > 0
    assert all("value" in item and "count" in item for item in body["most_common_values"])


def test_analyzer_column_profile_numeric_has_min_max_avg(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/columns/score/profile")

    assert response.status_code == 200
    body = response.json()
    assert body["min_value"] is not None
    assert body["max_value"] is not None
    assert body["avg_value"] is not None


def test_analyzer_column_profile_unknown_column_returns_404(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/columns/nope/profile")

    assert response.status_code == 404


def test_analyzer_sample_first_rows(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(
        f"/api/v1/tools/parquet-utility/analyzer/{file_id}/sample",
        params={"mode": "first", "size": 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "first"
    assert body["sample_size"] == 5
    assert [row["id"] for row in body["rows"]] == [1, 2, 3, 4, 5]


def test_analyzer_sample_random_rows(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(
        f"/api/v1/tools/parquet-utility/analyzer/{file_id}/sample",
        params={"mode": "random", "size": 5},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "random"
    assert body["sample_size"] == 5
    assert len(body["rows"]) == 5


def test_analyzer_sample_caps_at_total_rows(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(
        f"/api/v1/tools/parquet-utility/analyzer/{file_id}/sample",
        params={"mode": "first", "size": 5000},
    )

    assert response.status_code == 200
    assert response.json()["sample_size"] == 20


def test_analyzer_storage_analysis(client: TestClient) -> None:
    file_id = _uploaded_file_id(client)

    response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{file_id}/storage")

    assert response.status_code == 200
    body = response.json()
    assert body["compression"].lower() == "snappy"
    assert body["total_compressed_bytes"] > 0
    assert body["total_uncompressed_bytes"] > 0
    assert len(body["row_groups"]) >= 2  # row_group_size=8 over 20 rows -> 3 groups
    assert sum(rg["row_count"] for rg in body["row_groups"]) == 20
    assert {col["name"] for col in body["columns"]} == {"id", "name", "score", "is_active", "notes"}
    assert all(col["compression_ratio"] >= 0 for col in body["columns"])


def test_analyzer_unknown_session_returns_404_on_every_tab(client: TestClient) -> None:
    bogus_id = "does-not-exist"
    for path in ("overview", "schema", "statistics", "storage"):
        response = client.get(f"/api/v1/tools/parquet-utility/analyzer/{bogus_id}/{path}")
        assert response.status_code == 404, path

    assert client.get(f"/api/v1/tools/parquet-utility/analyzer/{bogus_id}/columns/id/profile").status_code == 404
    assert client.get(f"/api/v1/tools/parquet-utility/analyzer/{bogus_id}/sample").status_code == 404


def test_analyzer_rejects_non_parquet_upload(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL, files={"file": ("data.csv", b"a,b\n1,2\n", "text/csv")}
    )
    assert response.status_code == 400


def test_analyzer_rejects_empty_upload(client: TestClient) -> None:
    response = client.post(
        UPLOAD_URL, files={"file": ("empty.parquet", b"", "application/octet-stream")}
    )
    assert response.status_code == 400
