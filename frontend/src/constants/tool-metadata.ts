/**
 * Human-readable labels for tool categories, used across catalog/dashboard UI.
 */
import type { ToolCategory, ToolStatus } from "@/types/tool";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  file_conversion: "File Conversion",
  formatting: "Formatting",
  comparison: "Comparison",
  validation: "Validation",
  etl: "ETL",
  data_quality: "Data Quality",
  metadata: "Metadata",
  cloud: "Cloud",
  productivity: "Productivity",
};

export const STATUS_LABELS: Record<ToolStatus, string> = {
  available: "Available",
  beta: "Beta",
  coming_soon: "Coming Soon",
  deprecated: "Deprecated",
};

/** Icon name (from the icon registry) representing each tool category. */
export const CATEGORY_ICONS: Record<ToolCategory, string> = {
  file_conversion: "ArrowLeftRight",
  formatting: "Braces",
  comparison: "GitCompare",
  validation: "ShieldCheck",
  etl: "Workflow",
  data_quality: "BadgeCheck",
  metadata: "Tags",
  cloud: "Cloud",
  productivity: "Zap",
};

