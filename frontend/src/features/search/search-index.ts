/**
 * Builds the global search index from live data sources: the Tool
 * Registry (backend) plus any tool's own feature registry (frontend).
 *
 * Adding search support for a new tool's sub-features means registering
 * one entry in `TOOL_FEATURE_PROVIDERS` below — the search UI, scoring,
 * and keyboard navigation never need to change.
 */
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import { PARQUET_MODULES } from "@/features/parquet/registry/module-registry";
import type { SearchResultItem } from "@/features/search/types";
import type { ToolMetadata } from "@/types/tool";

interface FeatureLike {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const TOOL_FEATURE_PROVIDERS: Record<string, () => FeatureLike[]> = {
  "parquet-utility": () => PARQUET_MODULES,
};

export function buildSearchIndex(tools: ToolMetadata[]): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const seenCategories = new Set<string>();

  for (const tool of tools) {
    items.push({
      id: `tool:${tool.id}`,
      kind: "tool",
      title: tool.name,
      description: tool.description,
      href: tool.route,
      icon: tool.icon,
      keywords: [CATEGORY_LABELS[tool.category]],
    });

    if (!seenCategories.has(tool.category)) {
      seenCategories.add(tool.category);
      items.push({
        id: `category:${tool.category}`,
        kind: "category",
        title: CATEGORY_LABELS[tool.category],
        description: `Browse ${CATEGORY_LABELS[tool.category]} tools`,
        href: `/tools?category=${tool.category}`,
        icon: "LayoutGrid",
        keywords: [],
      });
    }

    for (const feature of TOOL_FEATURE_PROVIDERS[tool.id]?.() ?? []) {
      items.push({
        id: `feature:${tool.id}:${feature.id}`,
        kind: "feature",
        title: feature.label,
        description: feature.description,
        href: `${tool.route}/${feature.id}`,
        icon: feature.icon,
        keywords: [tool.name],
        context: tool.name,
      });
    }
  }

  return items;
}
