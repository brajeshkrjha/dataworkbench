"""Parquet Utility: a container for parquet-related capabilities.

First release ships file conversion (CSV/JSON -> Parquet). Additional
modules are added to this single tool rather than as separate tools.
"""
from app.schemas.tools import ToolCategory, ToolMetadata, ToolStatus

TOOL = ToolMetadata(
    id="parquet-utility",
    name="Parquet Utility",
    description="A collection of tools for converting, exploring, and analyzing Apache Parquet datasets.",
    category=ToolCategory.FILE_CONVERSION,
    icon="Boxes",
    route="/tools/parquet-utility",
    version="0.1.0",
    status=ToolStatus.AVAILABLE,
    tags=["parquet", "csv", "json", "conversion"],
)
