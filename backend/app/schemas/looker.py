"""Schemas for the GCP Looker Utility tool (PBIP -> LookML conversion,
structure exploration, LookML preview, and package comparison)."""
from typing import Any

from pydantic import BaseModel, Field


class LookerConversionResult(BaseModel):
    """Metadata describing a completed PBIP -> LookML conversion."""

    project_name: str = Field(..., description="Name of the source PBIP project (file stem).")
    output_file_name: str = Field(..., description="Name of the generated LookML package ZIP.")
    views_generated: int = Field(..., description="Number of LookML views generated (one per model table).")
    explores_generated: int = Field(..., description="Number of LookML explores generated (one per fact table).")
    relationships_found: int = Field(..., description="Number of semantic model relationships detected.")
    measures_found: int = Field(..., description="Number of DAX measures carried over from the model.")


class PbipStructureStats(BaseModel):
    """Model-overview counters for the Explore PBIP Structure module."""

    total_tables: int
    total_columns: int
    total_measures: int
    total_relationships: int
    total_hierarchies: int
    total_roles: int
    fact_tables: int
    dimension_tables: int
    parameter_tables: int
    unused_measures: int
    unused_tables: int
    complexity_score: float


class PbipStructureResult(BaseModel):
    """Full structural breakdown of a PBIP project."""

    project_name: str
    stats: PbipStructureStats
    tables: list[dict[str, Any]]
    measures: list[dict[str, Any]]
    relationships: list[dict[str, Any]]
    roles: list[dict[str, Any]]
    lineage: list[dict[str, Any]]
    unused_measures: list[str]
    unused_tables: list[str]
    largest_tables: list[dict[str, Any]]


class LookmlPreviewResult(BaseModel):
    """Structured LookML generated for the Preview LookML module."""

    project_name: str
    model_file_name: str
    model_text: str
    views: list[dict[str, Any]]
    explores: list[dict[str, Any]]
    counts: dict[str, int]


class LookmlCompareSummary(BaseModel):
    views_added: int
    views_removed: int
    views_changed: int
    explores_added: int
    explores_removed: int
    explores_changed: int


class LookmlCompareResult(BaseModel):
    """Structural diff between two generated LookML packages."""

    project_name_a: str
    project_name_b: str
    source_type_a: str = Field(..., description="'pbip_project' or 'lookml_package', auto-detected.")
    source_type_b: str = Field(..., description="'pbip_project' or 'lookml_package', auto-detected.")
    summary: LookmlCompareSummary
    views_added: list[str]
    views_removed: list[str]
    view_changes: list[dict[str, Any]]
    explores_added: list[str]
    explores_removed: list[str]
    explore_changes: list[dict[str, Any]]
    risk_flags: list[str]


class BulkInvalidProject(BaseModel):
    """A project discovered in a bulk upload that could not be converted."""

    project_name: str
    reason: str


class BulkDiscoverySummary(BaseModel):
    """Counts and details from scanning a bulk upload for PBIP projects."""

    found: int = Field(..., description="Total .pbip files discovered anywhere in the upload.")
    valid: int = Field(..., description="Projects with a resolvable .Report and .SemanticModel folder.")
    invalid: int = Field(..., description="Projects missing required folders, skipped before conversion.")
    invalid_projects: list[BulkInvalidProject]


class BulkJobStartResult(BaseModel):
    """Returned immediately after starting a bulk conversion job."""

    job_id: str
    discovery: BulkDiscoverySummary


class BulkJobStatusResult(BaseModel):
    """Polled while a bulk conversion job is running."""

    job_id: str
    status: str = Field(..., description="'processing', 'completed', or 'failed'.")
    total: int = Field(..., description="Number of valid projects queued for conversion.")
    processed: int = Field(..., description="Number of those projects attempted so far.")
    current_project: str | None = Field(None, description="Project currently being converted, if any.")
    percent: float = Field(..., description="Overall progress, 0-100.")


class BulkProjectSuccess(BaseModel):
    project_name: str
    views_generated: int
    explores_generated: int


class BulkProjectFailure(BaseModel):
    project_name: str
    reason: str


class BulkJobSummaryResult(BaseModel):
    """Final (or in-progress) result summary for a bulk conversion job."""

    job_id: str
    status: str
    discovery: BulkDiscoverySummary
    processed: int
    successful: int
    failed: int
    successes: list[BulkProjectSuccess]
    failures: list[BulkProjectFailure]


