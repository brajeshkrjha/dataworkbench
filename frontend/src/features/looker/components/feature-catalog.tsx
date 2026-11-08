import { ModuleCard } from "@/features/looker/shared/module-card";
import { LOOKER_MODULES } from "@/features/looker/registry/module-registry";

/**
 * GCP Looker Utility landing page. Always acts as a feature catalog —
 * every module (available or planned) is rendered from the module
 * registry with equal visual weight so no single capability dominates.
 */
export function FeatureCatalog() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LOOKER_MODULES.map((module) => (
        <ModuleCard key={module.id} module={module} />
      ))}
    </div>
  );
}
