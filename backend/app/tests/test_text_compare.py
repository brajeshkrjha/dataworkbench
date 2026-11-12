"""Tests for the Text Compare Utility."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/tools/text-compare-utility"


def test_text_paste_comparison_detects_modifications() -> None:
    response = client.post(
        f"{BASE}/compare",
        data={"text_a": "line one\nline two\nline three", "text_b": "line one\nline TWO\nline three\nline four"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["input_type"] == "text"
    assert body["summary"]["added_count"] >= 1
    assert body["summary"]["modified_count"] >= 1
    assert body["text_detail"]["lines"]


def test_identical_text_has_zero_risk() -> None:
    response = client.post(
        f"{BASE}/compare",
        data={"text_a": "same\ntext", "text_b": "same\ntext"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["risk_level"] == "none"
    assert body["summary"]["similarity_score"] == 100.0


def test_json_comparison_detects_structural_changes() -> None:
    json_a = '{"name": "Alice", "age": 30, "tags": ["a", "b"]}'
    json_b = '{"name": "Alice", "age": 31, "tags": ["a"], "active": true}'
    response = client.post(
        f"{BASE}/compare",
        data={"text_a": json_a, "text_b": json_b},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["input_type"] == "json"
    assert body["structured_detail"] is not None
    assert body["structured_detail"]["keys_added"] >= 1
    assert body["structured_detail"]["values_changed"] >= 1


def test_csv_comparison_detects_row_and_column_changes() -> None:
    csv_a = "id,name,amount\n1,Widget,10\n2,Gadget,20\n"
    csv_b = "id,name,amount,region\n1,Widget,15,US\n3,Gizmo,30,EU\n"
    response = client.post(
        f"{BASE}/compare",
        data={"text_a": csv_a, "text_b": csv_b, "type_override": "csv"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["csv_detail"] is not None
    assert "region" in body["csv_detail"]["columns_added"]
    assert body["csv_detail"]["rows_modified"] >= 1


def test_sql_comparison_detects_table_and_filter_changes() -> None:
    sql_a = "SELECT id, name FROM users WHERE active = 1"
    sql_b = "SELECT id, name, email FROM accounts WHERE active = 1 AND verified = 1"
    response = client.post(
        f"{BASE}/compare",
        data={"text_a": sql_a, "text_b": sql_b, "type_override": "sql"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sql_detail"] is not None
    assert "accounts" in body["sql_detail"]["tables_added"]
    assert "users" in body["sql_detail"]["tables_removed"]


def test_mixed_upload_and_paste_input() -> None:
    files = {"file_a": ("a.txt", b"hello world", "text/plain")}
    response = client.post(
        f"{BASE}/compare",
        data={"text_b": "hello there"},
        files=files,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["file_name_a"] == "a.txt"
    assert body["file_name_b"] == "Version B"


def test_compare_requires_at_least_one_side() -> None:
    response = client.post(f"{BASE}/compare", data={"text_a": "only a side"})
    assert response.status_code == 400


def test_export_markdown_and_csv() -> None:
    compare_response = client.post(
        f"{BASE}/compare",
        data={"text_a": "a\nb", "text_b": "a\nc"},
    )
    result = compare_response.json()

    markdown_response = client.post(f"{BASE}/compare/export?format=markdown", json=result)
    assert markdown_response.status_code == 200
    assert "# Text Compare Report" in markdown_response.text

    csv_response = client.post(f"{BASE}/compare/export?format=csv", json=result)
    assert csv_response.status_code == 200
    assert "line_a,line_b,diff_type" in csv_response.text


def test_whitespace_only_difference_is_detected() -> None:
    for text_a, text_b in (
        ("abc", "abc "),
        ("select a from t", "select a  from t"),
        ('{"a": "x"}', '{"a": "x "}'),
    ):
        body = client.post(f"{BASE}/compare", data={"text_a": text_a, "text_b": text_b}).json()
        assert body["summary"]["total_differences"] >= 1, (text_a, body["input_type"])
        assert body["summary"]["similarity_score"] < 100
        assert any(line["diff_type"] != "identical" for line in body["text_detail"]["lines"])


def test_ignore_case_and_whitespace_options() -> None:
    base = {"text_a": "Hello  World\nsame", "text_b": "hello world \nsame"}
    strict = client.post(f"{BASE}/compare", data=base).json()
    assert strict["summary"]["total_differences"] >= 1

    relaxed = client.post(f"{BASE}/compare", data={**base, "ignore_case": "true", "ignore_whitespace": "true"}).json()
    assert relaxed["summary"]["total_differences"] == 0
    assert relaxed["summary"]["similarity_score"] == 100

    case_only = client.post(f"{BASE}/compare", data={**base, "ignore_case": "true"}).json()
    assert case_only["summary"]["total_differences"] >= 1

