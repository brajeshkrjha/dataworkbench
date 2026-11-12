/**
 * Text Compare Utility module registry.
 *
 * A feature-container tool like Parquet Utility and GCP Looker Utility:
 * the landing page renders this list as a catalog. Adding a module means
 * adding one entry here plus a route under
 * `app/tools/text-compare-utility/<id>/`.
 */
export type TextCompareModuleStatus = "available" | "planned";

export interface TextCompareModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: TextCompareModuleStatus;
}

export const TEXT_COMPARE_MODULES: TextCompareModuleDefinition[] = [
  {
    id: "compare",
    label: "Compare Text",
    description: "Side-by-side line diff of two texts or files, with swap, ignore options, and report export.",
    icon: "GitCompare",
    status: "available",
  },
  {
    id: "lists",
    label: "Compare Lists",
    description: "Find what is only in A, only in B, or in both for two line-separated lists such as IDs or column names.",
    icon: "ListChecks",
    status: "available",
  },
  {
    id: "cleanup",
    label: "Clean Up Text",
    description: "Trim, dedupe, sort, and normalize case for lines of text before you compare or reuse them.",
    icon: "Eraser",
    status: "available",
  },
];

export function getTextCompareModule(id: string): TextCompareModuleDefinition | undefined {
  return TEXT_COMPARE_MODULES.find((module) => module.id === id);
}
