import { ModuleCard } from "@/features/parquet/shared/module-card";
import { PARQUET_MODULES } from "@/features/parquet/registry/module-registry";

/**
 * Parquet Utility landing page. Always acts as a feature catalog —
 * every module (available or planned) is rendered from the module
 * registry with equal visual weight so no single capability dominates.
 */
export function FeatureCatalog() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
      {PARQUET_MODULES.map((module) => (
        <ModuleCard key={module.id} module={module} />
      ))}
    </div>
  );
}
