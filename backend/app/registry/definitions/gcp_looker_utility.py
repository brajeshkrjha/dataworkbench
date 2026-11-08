"""GCP Looker Utility: PBIP project conversion to LookML.

Initial module: Convert PBIP to LookML. Additional modules (merge
models, YAML export, documentation workbook, ...) are not part of
this phase and are added to this same tool later.
"""
from app.schemas.tools import ToolCategory, ToolMetadata, ToolStatus

TOOL = ToolMetadata(
    id="gcp-looker-utility",
    name="GCP Looker Utility",
    description="Convert Power BI PBIP projects into LookML packages for Looker.",
    category=ToolCategory.CLOUD,
    icon="Telescope",
    route="/tools/gcp-looker-utility",
    version="0.1.0",
    status=ToolStatus.AVAILABLE,
    tags=["looker", "lookml", "powerbi", "pbip", "bigquery", "conversion"],
)
