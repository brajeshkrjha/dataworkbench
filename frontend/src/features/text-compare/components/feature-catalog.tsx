import { CatalogCard } from "@/components/shared/catalog-card";
import { TEXT_COMPARE_MODULES } from "@/features/text-compare/registry/module-registry";

/** Text Compare Utility landing page: every module from the registry as an equal-weight card. */
export function FeatureCatalog() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TEXT_COMPARE_MODULES.map((module) => (
        <CatalogCard
          key={module.id}
          icon={module.icon}
          title={module.label}
          description={module.description}
          href={`/tools/text-compare-utility/${module.id}`}
          disabled={module.status !== "available"}
        />
      ))}
    </div>
  );
}
