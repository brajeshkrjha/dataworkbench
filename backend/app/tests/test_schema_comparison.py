"""Tests for the Schema Comparison endpoints (stateless: two files in, one
diff result out - no session id, unlike Reader/Analyzer)."""
import pyarrow as pa
import pyarrow.parquet as pq
from fastapi.testclient import TestClient

COMPARE_URL = "/api/v1/tools/parquet-utility/comparison/compare"
EXPORT_URL = "/api/v1/tools/parquet-utility/comparison/export"


def _build_bytes(table: pa.Table) -> bytes:
    buffer = pa.BufferOutputStream()
    pq.write_table(table, buffer, compression="snappy")
    return buffer.getvalue().to_pybytes()


BASE_TABLE = pa.table(
    {
        "id": pa.array([1, 2, 3], type=pa.int64()),
        "name": pa.array(["a", "b", "c"], type=pa.string()),
        "score": pa.array([1.5, 2.5, 3.5], type=pa.float64()),
    }
)


def _files(table_a: pa.Table, table_b: pa.Table):
    return {
        "file_a": ("a.parquet", _build_bytes(table_a), "application/octet-stream"),
        "file_b": ("b.parquet", _build_bytes(table_b), "application/octet-stream"),
    }


def test_identical_schemas_report_matching_health(client: TestClient) -> None:
    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, BASE_TABLE))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["health"] == "matching"
    assert body["summary"]["total_differences"] == 0
    assert body["summary"]["identical_columns"] == 3
    assert body["drift"]["drift_score"] == 0.0
    assert body["drift"]["match_percentage"] == 100.0


def test_added_column_is_low_risk(client: TestClient) -> None:
    table_b = BASE_TABLE.append_column("region", pa.array(["us", "eu", "apac"], type=pa.string()))

    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, table_b))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["columns_added"] == 1
    added = next(c for c in body["columns"] if c["diff_type"] == "added")
    assert added["risk_level"] == "low"
    assert added["column_name"] == "region"
    assert body["summary"]["health"] == "minor_differences"


def test_removed_column_is_high_risk_and_breaking(client: TestClient) -> None:
    table_b = BASE_TABLE.drop_columns(["score"])

    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, table_b))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["columns_removed"] == 1
    removed = next(c for c in body["columns"] if c["diff_type"] == "removed")
    assert removed["risk_level"] == "high"
    assert body["summary"]["health"] == "breaking_changes"


def test_type_change_is_high_risk(client: TestClient) -> None:
    table_b = BASE_TABLE.set_column(0, "id", pa.array(["1", "2", "3"], type=pa.string()))

    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, table_b))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["type_changes"] == 1
    changed = next(c for c in body["columns"] if c["diff_type"] == "type_changed")
    assert changed["risk_level"] == "high"
    assert changed["data_type_a"] == "int64"
    assert changed["data_type_b"] == "string"
    assert body["summary"]["health"] == "breaking_changes"


def test_nullability_change_is_medium_risk(client: TestClient) -> None:
    schema_a = pa.schema([pa.field("id", pa.int64(), nullable=False), pa.field("name", pa.string(), nullable=True)])
    schema_b = pa.schema([pa.field("id", pa.int64(), nullable=True), pa.field("name", pa.string(), nullable=True)])
    table_a = pa.table({"id": [1, 2], "name": ["a", "b"]}, schema=schema_a)
    table_b = pa.table({"id": [1, 2], "name": ["a", "b"]}, schema=schema_b)

    response = client.post(COMPARE_URL, files=_files(table_a, table_b))

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["nullability_changes"] == 1
    changed = next(c for c in body["columns"] if c["diff_type"] == "nullability_changed")
    assert changed["risk_level"] == "medium"
    assert body["summary"]["health"] == "minor_differences"


def test_drift_score_reflects_partial_match(client: TestClient) -> None:
    table_b = BASE_TABLE.drop_columns(["score"])

    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, table_b))

    assert response.status_code == 200
    body = response.json()
    assert 0 < body["drift"]["match_percentage"] < 100
    assert body["drift"]["drift_score"] > 0
    assert "removed" in body["drift"]["explanation"] or "removed" in str(body["drift"]["explanation"])


def test_renamed_column_best_effort_match(client: TestClient) -> None:
    table_b = BASE_TABLE.rename_columns(["id", "full_name", "score"])

    response = client.post(COMPARE_URL, files=_files(BASE_TABLE, table_b))

    assert response.status_code == 200
    body = response.json()
    renamed = [c for c in body["columns"] if c["diff_type"] == "renamed"]
    assert len(renamed) == 1
    assert renamed[0]["name_a"] == "name"
    assert renamed[0]["name_b"] == "full_name"
    assert renamed[0]["rename_confidence"] > 0


def test_rejects_non_parquet_file(client: TestClient) -> None:
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.parquet", _build_bytes(BASE_TABLE), "application/octet-stream"),
            "file_b": ("b.csv", b"a,b\n1,2\n", "text/csv"),
        },
    )
    assert response.status_code == 400


def test_export_markdown_report(client: TestClient) -> None:
    compare_response = client.post(COMPARE_URL, files=_files(BASE_TABLE, BASE_TABLE.drop_columns(["score"])))
    result = compare_response.json()

    response = client.post(f"{EXPORT_URL}?format=markdown", json=result)

    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]
    assert "# Schema Comparison Report" in response.text
    assert "score" in response.text


def test_export_csv_report(client: TestClient) -> None:
    compare_response = client.post(COMPARE_URL, files=_files(BASE_TABLE, BASE_TABLE.drop_columns(["score"])))
    result = compare_response.json()

    response = client.post(f"{EXPORT_URL}?format=csv", json=result)

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "column_name,diff_type,risk_level" in response.text
    assert "score" in response.text
