"""Characterization tests for the GCP Looker Utility (PBIP -> LookML)."""
import io
import json
import zipfile

CONVERT_URL = "/api/v1/tools/gcp-looker-utility/convert"
EXPLORE_URL = "/api/v1/tools/gcp-looker-utility/explore"
PREVIEW_URL = "/api/v1/tools/gcp-looker-utility/preview"
COMPARE_URL = "/api/v1/tools/gcp-looker-utility/compare"


def _zip_bytes(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    return buffer.getvalue()


def _minimal_pbip_project(project_name: str = "Sales") -> dict[str, str]:
    """A minimal but structurally valid PBIP project: .pbip + Report + SemanticModel."""
    report_json = json.dumps({"layouts": []})
    version_json = json.dumps({"version": "1.0"})
    model_tmdl = (
        "table Customer\n"
        "    column Id\n"
        "        dataType: string\n\n"
        "    column Name\n"
        "        dataType: string\n\n"
        "table Sales\n"
        "    column CustomerId\n"
        "        dataType: string\n\n"
        "    measure 'Total Sales' = SUM(Sales[Amount])\n"
    )
    relationships_tmdl = (
        "relationship rel1\n"
        "    fromColumn: Sales.CustomerId\n"
        "    toColumn: Customer.Id\n"
    )
    return {
        f"{project_name}.pbip": json.dumps({"version": "1.0"}),
        f"{project_name}.Report/report.json": report_json,
        f"{project_name}.Report/definition.pbir": json.dumps({"version": "1.0"}),
        f"{project_name}.SemanticModel/definition/model.tmdl": model_tmdl,
        f"{project_name}.SemanticModel/definition/relationships.tmdl": relationships_tmdl,
        f"{project_name}.SemanticModel/definition.pbism": version_json,
    }


def test_convert_missing_pbip_file_returns_400(client):
    upload = _zip_bytes({"readme.txt": "not a pbip project"})
    response = client.post(
        CONVERT_URL,
        files={"file": ("project.zip", upload, "application/zip")},
    )
    assert response.status_code == 400
    assert "pbip" in response.json()["message"].lower()


def test_convert_invalid_zip_returns_400(client):
    response = client.post(
        CONVERT_URL,
        files={"file": ("project.zip", b"not a zip file", "application/zip")},
    )
    assert response.status_code == 400


def test_convert_empty_file_returns_400(client):
    response = client.post(
        CONVERT_URL,
        files={"file": ("project.zip", b"", "application/zip")},
    )
    assert response.status_code == 400


def test_convert_missing_semantic_model_folder_returns_400(client):
    files = _minimal_pbip_project()
    del files["Sales.SemanticModel/definition/model.tmdl"]
    del files["Sales.SemanticModel/definition/relationships.tmdl"]
    del files["Sales.SemanticModel/definition.pbism"]
    upload = _zip_bytes(files)
    response = client.post(
        CONVERT_URL,
        files={"file": ("project.zip", upload, "application/zip")},
    )
    assert response.status_code == 400
    assert "semanticmodel" in response.json()["message"].lower()


def test_convert_valid_project_returns_lookml_zip(client):
    upload = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        CONVERT_URL,
        files={"file": ("Sales.zip", upload, "application/zip")},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.headers["x-looker-project-name"] == "Sales"
    assert int(response.headers["x-looker-views-generated"]) >= 1

    package = zipfile.ZipFile(io.BytesIO(response.content))
    names = package.namelist()
    assert any(name.endswith(".model.lkml") for name in names)
    assert any(name.endswith(".view.lkml") for name in names)


def _prefixed(files: dict[str, str], prefix: str) -> dict[str, str]:
    return {f"{prefix}{path}": content for path, content in files.items()}


def test_convert_ignores_archive_and_wrapper_folder_names(client):
    """Discovery keys off the .pbip, never off the archive or folder wrapping it."""
    layouts = {
        "at the archive root": "",
        "inside one wrapper folder": "sample_project/",
        "inside nested wrapper folders": "AnyFolder/NestedFolder/",
    }
    for label, prefix in layouts.items():
        upload = _zip_bytes(_prefixed(_minimal_pbip_project(), prefix))
        response = client.post(
            CONVERT_URL,
            files={"file": ("abc.zip", upload, "application/zip")},
        )
        assert response.status_code == 200, f"failed with project {label}"
        assert response.headers["x-looker-project-name"] == "Sales"


def test_convert_ignores_macos_archive_artifacts(client):
    """macOS zips add a parallel __MACOSX tree whose "._" stubs must not win."""
    files = _prefixed(_minimal_pbip_project(), "sample_pbip/")
    files["__MACOSX/sample_pbip/._Sales.pbip"] = "resource fork stub"
    files["sample_pbip/.DS_Store"] = "finder metadata"

    response = client.post(
        CONVERT_URL,
        files={"file": ("test.zip", _zip_bytes(files), "application/zip")},
    )
    assert response.status_code == 200
    assert response.headers["x-looker-project-name"] == "Sales"


def test_convert_prefers_the_pbip_that_actually_resolves(client):
    """A decoy .pbip without its folders must not shadow the real project."""
    files = _prefixed(_minimal_pbip_project(), "Deep/")
    files["Archived.pbip"] = json.dumps({"version": "1.0"})

    response = client.post(
        CONVERT_URL,
        files={"file": ("project.zip", _zip_bytes(files), "application/zip")},
    )
    assert response.status_code == 200
    assert response.headers["x-looker-project-name"] == "Sales"


# ---- Explore PBIP Structure ----


def test_explore_missing_pbip_file_returns_400(client):
    upload = _zip_bytes({"readme.txt": "not a pbip project"})
    response = client.post(
        EXPLORE_URL,
        files={"file": ("project.zip", upload, "application/zip")},
    )
    assert response.status_code == 400


def test_explore_empty_file_returns_400(client):
    response = client.post(
        EXPLORE_URL,
        files={"file": ("project.zip", b"", "application/zip")},
    )
    assert response.status_code == 400


def test_explore_valid_project_returns_structure(client):
    upload = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        EXPLORE_URL,
        files={"file": ("Sales.zip", upload, "application/zip")},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["project_name"] == "Sales"
    assert body["stats"]["total_tables"] >= 1
    assert body["stats"]["total_measures"] >= 1
    assert body["stats"]["total_relationships"] >= 1

    table_names = {t["table_name"] for t in body["tables"]}
    assert table_names
    assert all(t["classification"] in {"fact", "dimension", "parameter"} for t in body["tables"])

    measure_names = {m["measure_name"] for m in body["measures"]}
    assert "Total Sales" in measure_names

    assert len(body["relationships"]) >= 1
    assert isinstance(body["largest_tables"], list)


# ---- Preview LookML ----


def test_preview_missing_pbip_file_returns_400(client):
    upload = _zip_bytes({"readme.txt": "not a pbip project"})
    response = client.post(
        PREVIEW_URL,
        files={"file": ("project.zip", upload, "application/zip")},
    )
    assert response.status_code == 400


def test_preview_valid_project_returns_structured_lookml(client):
    upload = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        PREVIEW_URL,
        files={"file": ("Sales.zip", upload, "application/zip")},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["project_name"] == "Sales"
    assert body["model_file_name"].endswith(".model.lkml")
    assert "connection:" in body["model_text"]
    assert body["counts"]["views"] >= 1

    view_names = {v["view_name"] for v in body["views"]}
    assert view_names.issubset({"customer", "sales"} | {n.lower() for n in view_names})
    assert all(v["lookml"].startswith("view:") for v in body["views"])
    assert all(e["lookml"].startswith("explore:") for e in body["explores"])


# ---- Compare LookML Packages ----


def test_compare_missing_pbip_file_returns_400(client):
    upload = _zip_bytes({"readme.txt": "not a pbip project"})
    valid = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.zip", upload, "application/zip"),
            "file_b": ("b.zip", valid, "application/zip"),
        },
    )
    assert response.status_code == 400


def test_compare_identical_projects_reports_no_changes(client):
    upload = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.zip", upload, "application/zip"),
            "file_b": ("b.zip", upload, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source_type_a"] == "pbip_project"
    assert body["source_type_b"] == "pbip_project"
    assert body["summary"]["views_added"] == 0
    assert body["summary"]["views_removed"] == 0
    assert body["summary"]["views_changed"] == 0
    assert body["risk_flags"] == []


def test_compare_detects_removed_measure_as_a_risk(client):
    project_a = _minimal_pbip_project()
    project_b = _minimal_pbip_project()
    project_b["Sales.SemanticModel/definition/model.tmdl"] = (
        "table Customer\n"
        "    column Id\n"
        "        dataType: string\n\n"
        "    column Name\n"
        "        dataType: string\n\n"
        "table Sales\n"
        "    column CustomerId\n"
        "        dataType: string\n"
    )

    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.zip", _zip_bytes(project_a), "application/zip"),
            "file_b": ("b.zip", _zip_bytes(project_b), "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["views_changed"] >= 1
    assert any("Total Sales" in flag or "total_sales" in flag.lower() for flag in body["risk_flags"])


def _generated_lookml_package_bytes(client, project_name: str = "Sales") -> bytes:
    """Runs a real PBIP project through /convert to get a genuine generated LookML package ZIP."""
    upload = _zip_bytes(_minimal_pbip_project(project_name))
    response = client.post(CONVERT_URL, files={"file": (f"{project_name}.zip", upload, "application/zip")})
    assert response.status_code == 200
    return response.content


def test_compare_detects_lookml_package_source_type(client):
    """A raw .lkml zip (no .pbip file) must be auto-detected as a LookML package."""
    lookml_zip = _generated_lookml_package_bytes(client)
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("Sales_LookML.zip", lookml_zip, "application/zip"),
            "file_b": ("Sales_LookML.zip", lookml_zip, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source_type_a"] == "lookml_package"
    assert body["source_type_b"] == "lookml_package"


def test_compare_lookml_vs_lookml_identical_reports_no_changes(client):
    lookml_zip = _generated_lookml_package_bytes(client)
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.zip", lookml_zip, "application/zip"),
            "file_b": ("b.zip", lookml_zip, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["views_added"] == 0
    assert body["summary"]["views_removed"] == 0
    assert body["summary"]["views_changed"] == 0
    assert body["summary"]["explores_added"] == 0
    assert body["summary"]["explores_removed"] == 0
    assert body["risk_flags"] == []


def test_compare_lookml_vs_lookml_detects_removed_view(client):
    lookml_zip_a = _generated_lookml_package_bytes(client)
    package = zipfile.ZipFile(io.BytesIO(lookml_zip_a))
    files = {name: package.read(name).decode("utf-8") for name in package.namelist()}
    view_files = [name for name in files if name.endswith(".view.lkml")]
    assert view_files, "fixture must produce at least one view file"
    del files[view_files[0]]
    lookml_zip_b = _zip_bytes(files)

    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("a.zip", lookml_zip_a, "application/zip"),
            "file_b": ("b.zip", lookml_zip_b, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["views_removed"] == 1
    assert any("was removed" in flag for flag in body["risk_flags"])


def test_compare_pbip_vs_lookml_reports_no_drift_for_matching_source(client):
    """The core migration-validation scenario: does an already-generated LookML
    package still match the PBIP project it came from?"""
    pbip_upload = _zip_bytes(_minimal_pbip_project())
    lookml_zip = _generated_lookml_package_bytes(client)

    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("Sales.zip", pbip_upload, "application/zip"),
            "file_b": ("Sales_LookML.zip", lookml_zip, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source_type_a"] == "pbip_project"
    assert body["source_type_b"] == "lookml_package"
    assert body["summary"]["views_added"] == 0
    assert body["summary"]["views_removed"] == 0
    assert body["summary"]["views_changed"] == 0
    assert body["risk_flags"] == []


def test_compare_lookml_vs_pbip_reverse_direction_also_works(client):
    pbip_upload = _zip_bytes(_minimal_pbip_project())
    lookml_zip = _generated_lookml_package_bytes(client)

    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("Sales_LookML.zip", lookml_zip, "application/zip"),
            "file_b": ("Sales.zip", pbip_upload, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source_type_a"] == "lookml_package"
    assert body["source_type_b"] == "pbip_project"
    assert body["summary"]["views_changed"] == 0


def test_compare_pbip_vs_lookml_detects_drift_after_migration(client):
    """A PBIP source that has since gained a measure the LookML package doesn't have yet."""
    lookml_zip = _generated_lookml_package_bytes(client)

    drifted_project = _minimal_pbip_project()
    drifted_project["Sales.SemanticModel/definition/model.tmdl"] += "\n    measure 'Total Cost' = SUM(Sales[Cost])\n"
    pbip_upload = _zip_bytes(drifted_project)

    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("Sales_LookML.zip", lookml_zip, "application/zip"),
            "file_b": ("Sales.zip", pbip_upload, "application/zip"),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["views_changed"] >= 1


def test_compare_unrecognized_source_type_returns_400(client):
    """Neither a .pbip file nor any .lkml files - detection must fail clearly."""
    upload = _zip_bytes({"readme.txt": "nothing recognizable here"})
    valid = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("mystery.zip", upload, "application/zip"),
            "file_b": ("b.zip", valid, "application/zip"),
        },
    )
    assert response.status_code == 400
    assert "determine" in response.json()["message"].lower()


def test_compare_lookml_package_with_no_lkml_files_returns_error(client):
    """A .lkml-free, .pbip-free upload is caught by detection before reaching the parser."""
    upload = _zip_bytes({"model.txt": "not lookml"})
    valid = _zip_bytes(_minimal_pbip_project())
    response = client.post(
        COMPARE_URL,
        files={
            "file_a": ("empty.zip", upload, "application/zip"),
            "file_b": ("b.zip", valid, "application/zip"),
        },
    )
    assert response.status_code == 400


