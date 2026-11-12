"""Text Compare Utility: a professional diff/comparison workspace."""
from app.schemas.tools import ToolCategory, ToolMetadata, ToolStatus

TOOL = ToolMetadata(
    id="text-compare-utility",
    name="Text Compare Utility",
    description="Compare texts and lists side-by-side and clean up text before you reuse it.",
    category=ToolCategory.COMPARISON,
    icon="GitCompare",
    route="/tools/text-compare-utility",
    version="0.1.0",
    status=ToolStatus.AVAILABLE,
    tags=["compare", "diff", "text", "lists", "dedupe", "sort"],
)
