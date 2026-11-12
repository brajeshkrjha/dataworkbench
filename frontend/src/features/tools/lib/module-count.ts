/**
 * Maps a "feature-container" tool (one that hosts a sub-module registry,
 * e.g. Parquet Utility) to its module count. Tools without a registered
 * module registry are treated as a single-purpose tool (count of 1).
 *
 * Adding a new feature-container tool means adding one entry here — the
 * Workspace Insights and tool cards pick it up automatically.
 */
import { LOOKER_MODULES } from "@/features/looker/registry/module-registry";
import { PARQUET_MODULES } from "@/features/parquet/registry/module-registry";
import { TEXT_COMPARE_MODULES } from "@/features/text-compare/registry/module-registry";

const MODULE_COUNTS_BY_TOOL_ID: Record<string, number> = {
  "parquet-utility": PARQUET_MODULES.length,
  "gcp-looker-utility": LOOKER_MODULES.length,
  "text-compare-utility": TEXT_COMPARE_MODULES.length,
};

export function getToolModuleCount(toolId: string): number {
  return MODULE_COUNTS_BY_TOOL_ID[toolId] ?? 1;
}

export function getTotalModuleCount(toolIds: string[]): number {
  return toolIds.reduce((sum, id) => sum + getToolModuleCount(id), 0);
}
