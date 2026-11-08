"""Tests for the Parquet Utility conversion endpoint."""
import io
import json
import re

import fastavro
import pyarrow as pa
import pyarrow.orc as pa_orc
import pyarrow.parquet as pq
from fastapi.testclient import TestClient
from openpyxl import Workbook

CONVERT_URL = "/api/v1/tools/parquet-utility/convert"

CSV_CONTENT = b"id,name,score\n1,alice,9.5\n2,bob,7.25\n3,carol,8\n"
TSV_CONTENT = b"id\tname\tscore\n1\talice\t9.5\n2\tbob\t7.25\n"
NDJSON_CONTENT = b'{"id": 1, "name": "alice"}\n{"id": 2, "name": "bob"}\n'
JSON_ARRAY_CONTENT = json.dumps(
    [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]
).encode()
XML_CONTENT = (
    b"<rows>"
    b"<row><id>1</id><name>alice</name></row>"
    b"<row><id>2</id><name>bob</name></row>"
    b"</rows>"
)


def _read_parquet(response_bytes: bytes):
    return pq.read_table(io.BytesIO(response_bytes))


def _build_excel_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["id", "name"])
    sheet.append([1, "alice"])
    sheet.append([2, "bob"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _build_avro_bytes() -> bytes:
    schema = {
        "type": "record",
        "name": "Person",
        "fields": [{"name": "id", "type": "int"}, {"name": "name", "type": "string"}],
    }
    records = [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]
    buffer = io.BytesIO()
    fastavro.writer(buffer, schema, records)
    return buffer.getvalue()


def _build_orc_bytes() -> bytes:
    table = pa.table({"id": [1, 2], "name": ["alice", "bob"]})
    buffer = pa.BufferOutputStream()
    pa_orc.write_table(table, buffer)
    return buffer.getvalue().to_pybytes()


EXCEL_CONTENT = _build_excel_bytes()
AVRO_CONTENT = _build_avro_bytes()
ORC_CONTENT = _build_orc_bytes()

TIMESTAMPED_NAME_PATTERN = re.compile(r"^people_\d{8}_\d{6}\.parquet$")


def test_convert_valid_csv(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("people.csv", CSV_CONTENT, "text/csv")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "csv"
    assert response.headers["x-conversion-compression"] == "snappy"
    assert response.headers["x-conversion-row-count"] == "3"
    assert response.headers["x-conversion-column-count"] == "3"
    assert TIMESTAMPED_NAME_PATTERN.match(response.headers["x-conversion-file-name"])

    table = _read_parquet(response.content)
    assert table.num_rows == 3
    assert table.column_names == ["id", "name", "score"]


def test_convert_valid_ndjson(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("events.json", NDJSON_CONTENT, "application/json")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "json"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name"]


def test_convert_valid_json_array(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("events.json", JSON_ARRAY_CONTENT, "application/json")}
    )

    assert response.status_code == 200
    table = _read_parquet(response.content)
    assert table.num_rows == 2


def test_convert_applies_requested_compression(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("people.csv", CSV_CONTENT, "text/csv")},
        data={"compression": "gzip"},
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-compression"] == "gzip"
    metadata = pq.read_metadata(io.BytesIO(response.content))
    assert metadata.row_group(0).column(0).compression.lower() == "gzip"


def test_convert_supports_uncompressed_output(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("people.csv", CSV_CONTENT, "text/csv")},
        data={"compression": "none"},
    )

    assert response.status_code == 200
    assert _read_parquet(response.content).num_rows == 3


def test_convert_without_custom_name_appends_timestamp(client: TestClient) -> None:
    """Default (source-derived) file names get a timestamp to avoid collisions."""
    first = client.post(
        CONVERT_URL, files={"file": ("people.csv", CSV_CONTENT, "text/csv")}
    )
    second = client.post(
        CONVERT_URL, files={"file": ("people.csv", CSV_CONTENT, "text/csv")}
    )

    first_name = first.headers["x-conversion-file-name"]
    second_name = second.headers["x-conversion-file-name"]

    assert TIMESTAMPED_NAME_PATTERN.match(first_name)
    assert TIMESTAMPED_NAME_PATTERN.match(second_name)
    # The actual download name (Content-Disposition) must match the header.
    assert first_name in first.headers["content-disposition"]


def test_convert_uses_custom_output_file_name(client: TestClient) -> None:
    """A user-provided name is preserved exactly, with no timestamp appended."""
    response = client.post(
        CONVERT_URL,
        files={"file": ("people.csv", CSV_CONTENT, "text/csv")},
        data={"output_file_name": "my report"},
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-file-name"] == "my_report.parquet"
    assert "my_report.parquet" in response.headers["content-disposition"]


def test_convert_rejects_unsupported_file_type(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("notes.txt", b"hello", "text/plain")}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "UnsupportedFileTypeError"


def test_convert_rejects_empty_file(client: TestClient) -> None:
    response = client.post(CONVERT_URL, files={"file": ("empty.csv", b"", "text/csv")})

    assert response.status_code == 400
    assert response.json()["error"] == "EmptyFileError"


def test_convert_rejects_invalid_json(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("broken.json", b"{not valid json", "application/json")}
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_rejects_json_of_scalars(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("scalars.json", b"[1, 2, 3]", "application/json")}
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_rejects_malformed_csv(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("bad.csv", b"a,b\n1,2\n3,4,5,6\n", "text/csv")},
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_requires_a_file(client: TestClient) -> None:
    response = client.post(CONVERT_URL, data={"compression": "snappy"})

    assert response.status_code == 422


def test_convert_rejects_unknown_compression(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("people.csv", CSV_CONTENT, "text/csv")},
        data={"compression": "lz4"},
    )

    assert response.status_code == 422


def test_convert_valid_tsv(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("people.tsv", TSV_CONTENT, "text/tab-separated-values")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "tsv"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name", "score"]


def test_convert_rejects_malformed_tsv(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("bad.tsv", b"a\tb\n1\t2\n3\t4\t5\n", "text/tab-separated-values")},
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_valid_excel(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={
            "file": (
                "people.xlsx",
                EXCEL_CONTENT,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "excel"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name"]


def test_convert_rejects_invalid_excel(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={
            "file": (
                "broken.xlsx",
                b"not a real workbook",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_valid_xml(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("people.xml", XML_CONTENT, "application/xml")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "xml"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name"]


def test_convert_rejects_malformed_xml(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("broken.xml", b"<rows><row><id>1</id></rows>", "application/xml")},
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_valid_avro(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("people.avro", AVRO_CONTENT, "application/avro")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "avro"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name"]


def test_convert_rejects_invalid_avro(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("broken.avro", b"not a real avro file", "application/avro")},
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"


def test_convert_valid_orc(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL, files={"file": ("people.orc", ORC_CONTENT, "application/octet-stream")}
    )

    assert response.status_code == 200
    assert response.headers["x-conversion-source-format"] == "orc"
    assert response.headers["x-conversion-row-count"] == "2"

    table = _read_parquet(response.content)
    assert table.column_names == ["id", "name"]


def test_convert_rejects_invalid_orc(client: TestClient) -> None:
    response = client.post(
        CONVERT_URL,
        files={"file": ("broken.orc", b"not a real orc file", "application/octet-stream")},
    )

    assert response.status_code == 422
    assert response.json()["error"] == "FileParseError"
