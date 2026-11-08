"""Strategy-based source adapters for the Compare LookML Packages module.

Each adapter turns an uploaded ZIP of a known source type into the same
"preview" shape (``project_name``, ``model_file_name``, ``model_text``,
``views``, ``explores``, ``counts``), so ``lookml_diff.diff_lookml_packages``
never needs to know or care whether either side started life as a PBIP
project or an already-generated LookML package - it just diffs two preview
dicts. Adding a future source type (a git-hosted LookML project, a raw
single .view.lkml upload, ...) means adding one adapter here and
registering it in ``_ADAPTERS``; no changes to the diff engine or the four
comparison combinations it already supports.
"""
from typing import Protocol

from app.services.looker.lookml_package_parser import parse_lookml_package
from app.services.looker.pipeline import parse_pbip_upload
from app.services.looker.preview_builder import build_lookml_preview
from app.services.looker.source_detection import (
    SOURCE_TYPE_LOOKML,
    SOURCE_TYPE_PBIP,
    detect_source_type,
)


class SourceAdapter(Protocol):
    """Anything that can turn an upload of its ``source_type`` into a preview dict."""

    source_type: str

    def build_preview(self, upload_bytes: bytes, upload_name: str) -> dict: ...


class PbipSourceAdapter:
    """Adapts a PBIP project ZIP by running the full parse + LookML-generation pipeline."""

    source_type = SOURCE_TYPE_PBIP

    def build_preview(self, upload_bytes: bytes, upload_name: str) -> dict:
        pbip_file, _report_data, model_data, clean_views = parse_pbip_upload(upload_bytes, upload_name)
        return build_lookml_preview(pbip_file, model_data, clean_views)


class LookmlPackageSourceAdapter:
    """Adapts an already-generated LookML package ZIP directly - no PBIP parsing involved."""

    source_type = SOURCE_TYPE_LOOKML

    def build_preview(self, upload_bytes: bytes, upload_name: str) -> dict:
        return parse_lookml_package(upload_bytes, upload_name)


_ADAPTERS: dict[str, SourceAdapter] = {
    SOURCE_TYPE_PBIP: PbipSourceAdapter(),
    SOURCE_TYPE_LOOKML: LookmlPackageSourceAdapter(),
}


def resolve_adapter(upload_bytes: bytes, upload_name: str) -> SourceAdapter:
    """Detect an upload's source type and return the adapter that handles it."""
    source_type = detect_source_type(upload_bytes, upload_name)
    return _ADAPTERS[source_type]
