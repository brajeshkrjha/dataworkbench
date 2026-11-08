/**
 * GCP Looker Utility module registry.
 *
 * GCP Looker Utility is a feature-container tool: the landing page always
 * renders this list as a catalog, never a specific feature. Adding a
 * future module means adding one entry here (and, once implemented, a
 * route under `app/tools/gcp-looker-utility/<id>/`).
 */
export type LookerModuleStatus = "available" | "planned";

export interface LookerModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: LookerModuleStatus;
}

export const LOOKER_MODULES: LookerModuleDefinition[] = [
  {
    id: "convert",
    label: "Convert PBIP to LookML",
    description: "Convert a Power BI PBIP project into a LookML package for Looker.",
    icon: "FileCode2",
    status: "available",
  },
  {
    id: "explore",
    label: "Explore PBIP Structure",
    description: "Understand a PBIP project's tables, measures, relationships, and lineage without opening Power BI.",
    icon: "Workflow",
    status: "available",
  },
  {
    id: "preview",
    label: "Preview LookML",
    description: "Browse generated LookML views and explores in a searchable code workspace before downloading.",
    icon: "Eye",
    status: "available",
  },
  {
    id: "compare",
    label: "Compare LookML Packages",
    description: "Validate a migration by diffing two generated LookML packages for structural changes.",
    icon: "GitCompare",
    status: "available",
  },
];

export function getLookerModule(id: string): LookerModuleDefinition | undefined {
  return LOOKER_MODULES.find((module) => module.id === id);
}
