import { CatalogCard } from "@/components/shared/catalog-card";
import type { ParquetModuleDefinition } from "@/features/parquet/registry/module-registry";

/**
 * Renders a single Parquet Utility module as a catalog card. Modules that
 * aren't yet available render inert (no visible status text — a module is
 * only ever shown once it's ready to use). Uses the shared `CatalogCard`
 * so every catalog in the app (tools, tool modules, ...) looks and
 * behaves identically.
 */
export function ModuleCard({ module }: { module: ParquetModuleDefinition }) {
  const isAvailable = module.status === "available";

  return (
    <CatalogCard
      icon={module.icon}
      title={module.label}
      description={module.description}
      href={`/tools/parquet-utility/${module.id}`}
      disabled={!isAvailable}
    />
  );
}
