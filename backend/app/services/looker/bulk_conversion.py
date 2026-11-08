"""Per-project conversion step for bulk PBIP -> LookML jobs.

Deliberately thin: it calls the exact same `parse_report` / `parse_model` /
`build_clean_views` / `build_lookml_model` functions the single-project
pipeline (`pipeline.convert_pbip_to_lookml`) uses, just against a project
that's already been located and extracted as part of a larger batch. No
parsing/generation logic is duplicated or rewritten here.
"""
from app.core.exceptions import LookerGenerationError
from app.services.looker.bulk_discovery import DiscoveredProject
from app.services.looker.lookml_builder import build_lookml_model
from app.services.looker.model_parser import parse_model
from app.services.looker.report_parser import parse_report
from app.services.looker.usage_analysis import build_clean_views


def convert_discovered_project(project: DiscoveredProject) -> tuple[str, dict, list]:
    """Converts one already-validated `DiscoveredProject` into LookML.

    Returns ``(model_text, counts, views)`` - identical shape to what
    `build_lookml_model` already returns for the single-project flow.
    Raises ``LookerGenerationError`` on failure so the caller can record it
    as one project's failure without aborting the rest of the batch.
    """
    try:
        report_data = parse_report(project.report_root)
        model_data = parse_model(project.model_root)
        clean_views = build_clean_views(report_data, model_data)
        model_text, counts, views = build_lookml_model(project.pbip_file, model_data, clean_views)
    except Exception as exc:
        raise LookerGenerationError(str(exc)) from exc

    return model_text, counts, views
