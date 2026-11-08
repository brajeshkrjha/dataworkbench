/**
 * Target format registry for the "From Parquet" conversion direction
 * (Convert Files). Mirrors `format-registry.ts`'s "planned vs available"
 * pattern so future exports (JSON, Excel, TSV) only require a new entry
 * here plus a converter/endpoint, not a UI rework.
 */
import type { SourceFormatDefinition } from "@/features/parquet/shared/format-registry";

export type TargetFormatStatus = "available" | "planned";

export interface TargetFormatDefinition {
  id: string;
  label: string;
  description: string;
  extension: string;
  icon: string;
  status: TargetFormatStatus;
}

export const TARGET_FORMATS: TargetFormatDefinition[] = [
  {
    id: "csv",
    label: "CSV",
    description: "Comma-separated values",
    extension: "csv",
    icon: "FileCode2",
    status: "available",
  },
  {
    id: "json",
    label: "JSON",
    description: "JSON array of objects",
    extension: "json",
    icon: "Braces",
    status: "planned",
  },
  {
    id: "excel",
    label: "Excel",
    description: "XLSX workbook",
    extension: "xlsx",
    icon: "Table",
    status: "planned",
  },
  {
    id: "tsv",
    label: "TSV",
    description: "Tab-separated values",
    extension: "tsv",
    icon: "FileCode",
    status: "planned",
  },
];

/** Upload-zone definition for the parquet source file in the "From Parquet" direction. */
export const PARQUET_UPLOAD_FORMAT: SourceFormatDefinition = {
  id: "parquet",
  label: "Parquet",
  description: "Apache Parquet files",
  extensions: ["parquet"],
  icon: "Database",
  status: "available",
};
