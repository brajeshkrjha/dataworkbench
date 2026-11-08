"""Structured LookML preview.

Builds the same LookML the Convert module generates, but keeps it as
structured data (per-view / per-explore records) instead of only a ZIP -
lets the "Preview LookML" module render a project explorer + code viewer
without re-parsing the PBIP project. Reuses ``build_lookml_model`` (which
already returns the assembled model file text and per-view records) plus
``build_lookml_views``/``build_lookml_explores`` directly to also get
per-explore records with join counts.
"""
from pathlib import Path

import pandas as pd

from app.services.looker.lookml_builder import (
    build_lookml_explores,
    build_lookml_model,
    build_lookml_views,
)
from app.services.looker.lookml_naming import safe_model_name
from app.services.looker.table_classification import classify_model_tables


def build_lookml_preview(pbip_file: Path, model_data: dict, clean_views: dict) -> dict:
    model_text, counts, views = build_lookml_model(pbip_file, model_data, clean_views)

    classification = classify_model_tables(
        model_data.get("model_tables", pd.DataFrame()), clean_views.get("relationships", pd.DataFrame())
    )
    _views_for_refs, field_refs = build_lookml_views(model_data, clean_views)
    explores = build_lookml_explores(model_data, clean_views, classification, field_refs)

    model_name = safe_model_name(pbip_file.stem)

    return {
        "project_name": pbip_file.stem,
        "model_file_name": f"{model_name}.model.lkml",
        "model_text": model_text,
        "views": [
            {
                "view_name": v["view_name"],
                "table_name": v.get("table_name"),
                "file_name": f"{v['view_name']}.view.lkml",
                "lookml": v.get("lookml", ""),
            }
            for v in views
        ],
        "explores": [
            {
                "explore_name": e["explore_name"],
                "table_name": e["table_name"],
                "file_name": f"{e['explore_name']}.explore.lkml",
                "join_count": e["join_count"],
                "lookml": e["lookml"],
            }
            for e in explores
        ],
        "counts": {
            "views": counts.get("views", 0),
            "explores": counts.get("explores", 0),
        },
    }
