/**
 * Parquet Utility module registry.
 *
 * Parquet Utility is a feature-container tool: the landing page always
 * renders this list as a catalog, never a specific feature. Adding a
 * future module means adding one entry here (and, once implemented,
 * a route under `app/tools/parquet-utility/<id>/`).
 */
export type ParquetModuleStatus = "available" | "planned";

export interface ParquetModuleDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: ParquetModuleStatus;
}

export const PARQUET_MODULES: ParquetModuleDefinition[] = [
  {
    id: "convert",
    label: "Convert Files",
    description: "Convert CSV, JSON, and future formats into Parquet.",
    icon: "FileOutput",
    status: "available",
  },
  {
    id: "reader",
    label: "Read Parquet",
    description: "View parquet files directly in the browser.",
    icon: "Table",
    status: "available",
  },
  {
    id: "analyzer",
    label: "Parquet Analyzer",
    description: "Inspect schema, metadata, statistics, profiling, sampling, and storage in one workspace.",
    icon: "Microscope",
    status: "available",
  },
  {
    id: "comparison",
    label: "Schema Comparison",
    description: "Compare two parquet files to detect schema drift and breaking changes.",
    icon: "GitCompare",
    status: "available",
  },
];

export function getParquetModule(id: string): ParquetModuleDefinition | undefined {
  return PARQUET_MODULES.find((module) => module.id === id);
}
