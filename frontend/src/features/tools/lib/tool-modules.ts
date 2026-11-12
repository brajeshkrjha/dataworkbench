/**
 * Flat, link-ready view of the modules hosted by feature-container tools,
 * so Home can deep-link straight into a module instead of only the tool.
 */
import { LOOKER_MODULES } from "@/features/looker/registry/module-registry";
import { PARQUET_MODULES } from "@/features/parquet/registry/module-registry";
import { TEXT_COMPARE_MODULES } from "@/features/text-compare/registry/module-registry";

export interface ToolModuleLink {
  id: string;
  label: string;
  description: string;
  icon: string;
  href: string;
}

interface RegistryModule {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: string;
}

const MODULES_BY_TOOL_ID: Record<string, { basePath: string; modules: RegistryModule[] }> = {
  "parquet-utility": { basePath: "/tools/parquet-utility", modules: PARQUET_MODULES },
  "gcp-looker-utility": { basePath: "/tools/gcp-looker-utility", modules: LOOKER_MODULES },
  "text-compare-utility": { basePath: "/tools/text-compare-utility", modules: TEXT_COMPARE_MODULES },
};

/** Available modules of a tool; empty for single-purpose tools. */
export function getToolModules(toolId: string): ToolModuleLink[] {
  const entry = MODULES_BY_TOOL_ID[toolId];
  if (!entry) return [];
  return entry.modules
    .filter((module) => module.status === "available")
    .map((module) => ({
      id: module.id,
      label: module.label,
      description: module.description,
      icon: module.icon,
      href: `${entry.basePath}/${module.id}`,
    }));
}
