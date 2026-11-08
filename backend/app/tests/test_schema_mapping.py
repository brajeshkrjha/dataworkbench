"""Tests for schema inspection and datatype override conversion
("Convert Files" schema/datatype mapping feature)."""
import io
import json

import pyarrow.parquet as pq
from fastapi.testclient import TestClient

CONVERT_URL = "/api/v1/tools/parquet-utility/convert"
INSPECT_URL = "/api/v1/tools/parquet-utility/convert/inspect"

CSV_CONTENT = (
    b"Customer_ID,Amount,Store_Nbr,Active\n"
    b"C1,19.99,101,true\n"
    b"C2,5.50,102,false\n"
    b"C3,,103,true\n"
)


def _read_parquet(response_bytes: bytes):
    return pq.read_table(io.BytesIO(response_bytes))


# ---- Schema inspection (auto detection) ----


def test_inspect_detects_types_samples_and_nulls(client: TestClient) -> None:
    response = client.post(INSPECT_URL, files={"file": ("sales.csv", CSV_CONTENT, "text/csv")})

    assert response.status_code == 200
    body = response.json()
    assert body["row_sample_count"] == 3
    fields = {f["name"]: f for f in body["fields"]}

    assert fields["Customer_ID"]["detected_type"] == "string"
    assert fields["Amount"]["detected_type"] == "double"
    assert fields["Store_Nbr"]["detected_type"] in {"integer", "long"}
    assert fields["Active"]["detected_type"] == "boolean"

    # One null Amount out of 3 rows -> ~33.33%
    assert fields["Amount"]["null_percentage"] > 0
    assert len(fields["Customer_ID"]["sample_values"]) > 0
    assert len(body["preview_rows"]) == 3


def test_inspect_rejects_unsupported_format(client: TestClient) -> None:
    response = client.post(
        INSPECT_URL,
        files={"file": ("data.json", b'{"id": 1}', "application/json")},
    )
    assert response.status_code == 400


# ---- Manual datatype overrides ----


def test_convert_with_manual_override(client: TestClient) -> None:
    overrides = json.dumps([{"column": "Amount", "data_type": "decimal"}])
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": overrides},
    )

    assert response.status_code == 200
    table = _read_parquet(response.content)
    assert str(table.schema.field("Amount").type).startswith("decimal")

    summary = json.loads(response.headers["x-conversion-schema-summary"])
    assert summary.get("decimal") == 1


def test_convert_without_overrides_keeps_auto_inference(client: TestClient) -> None:
    response = client.post(CONVERT_URL, files={"file": ("sales.csv", CSV_CONTENT, "text/csv")})

    assert response.status_code == 200
    table = _read_parquet(response.content)
    assert table.schema.field("Amount").type == __import__("pyarrow").float64()
    summary = json.loads(response.headers["x-conversion-schema-summary"])
    assert sum(summary.values()) == 4


# ---- Bulk actions (set all to X) ----


def test_set_all_columns_to_string(client: TestClient) -> None:
    overrides = json.dumps(
        [
            {"column": "Customer_ID", "data_type": "string"},
            {"column": "Amount", "data_type": "string"},
            {"column": "Store_Nbr", "data_type": "string"},
            {"column": "Active", "data_type": "string"},
        ]
    )
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": overrides},
    )

    assert response.status_code == 200
    table = _read_parquet(response.content)
    for field in table.schema:
        assert str(field.type) == "string"

    summary = json.loads(response.headers["x-conversion-schema-summary"])
    assert summary == {"string": 4}


def test_set_all_to_integer_then_reset_subset(client: TestClient) -> None:
    # "Set all to string" then manually change two columns back - a partial
    # bulk action, the most common real-world workflow.
    overrides = json.dumps(
        [
            {"column": "Customer_ID", "data_type": "string"},
            {"column": "Amount", "data_type": "decimal"},
            {"column": "Store_Nbr", "data_type": "integer"},
            {"column": "Active", "data_type": "string"},
        ]
    )
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": overrides},
    )

    assert response.status_code == 200
    table = _read_parquet(response.content)
    assert table.schema.field("Store_Nbr").type == __import__("pyarrow").int32()
    assert str(table.schema.field("Amount").type).startswith("decimal")
    assert str(table.schema.field("Customer_ID").type) == "string"


# ---- Validation failures ----


def test_convert_rejects_incompatible_override(client: TestClient) -> None:
    overrides = json.dumps([{"column": "Customer_ID", "data_type": "integer"}])
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": overrides},
    )

    assert response.status_code == 422
    body = response.json()
    assert "incompatible" in body["message"].lower()


def test_convert_rejects_malformed_column_types_payload(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": "not-json"},
    )

    assert response.status_code == 422


def test_convert_rejects_unknown_data_type(client: TestClient) -> None:
    overrides = json.dumps([{"column": "Amount", "data_type": "not-a-type"}])
    response = client.post(
        CONVERT_URL,
        files={"file": ("sales.csv", CSV_CONTENT, "text/csv")},
        data={"column_types": overrides},
    )

    assert response.status_code == 422


# ---- Existing CSV conversion flow stays intact ----


def test_existing_csv_conversion_still_works(client: TestClient) -> None:
    response = client.post(CONVERT_URL, files={"file": ("sales.csv", CSV_CONTENT, "text/csv")})

    assert response.status_code == 200
    assert response.headers["x-conversion-row-count"] == "3"
    assert response.headers["x-conversion-column-count"] == "4"
