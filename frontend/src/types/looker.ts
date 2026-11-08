/**
 * Types for the GCP Looker Utility tool (Convert PBIP to LookML module).
 *
 * `LookerConversionResult` mirrors `backend/app/schemas/looker.py`; it is
 * returned as `X-Looker-*` response headers alongside the binary download,
 * which OpenAPI cannot express as a schema reference.
 */
export interface LookerConversionResult {
  projectName: string;
  outputFileName: string;
  viewsGenerated: number;
  exploresGenerated: number;
  relationshipsFound: number;
  measuresFound: number;
}

export interface ConvertedLookerPackage {
  result: LookerConversionResult;
  blob: Blob;
}

/**
 * Client-side pre-flight check of a selected PBIP project, run as soon as
 * the user picks it and before anything is sent to the backend. Purely a
 * UX aid — the backend remains the source of truth and re-validates the
 * project during conversion.
 */
export interface PbipValidation {
  status: "idle" | "valid" | "invalid";
  hasPbip: boolean;
  hasReportFolder: boolean;
  hasSemanticModelFolder: boolean;
  projectName: string | null;
}

export const IDLE_VALIDATION: PbipValidation = {
  status: "idle",
  hasPbip: false,
  hasReportFolder: false,
  hasSemanticModelFolder: false,
  projectName: null,
};

/**
 * Explore PBIP Structure / Preview LookML / Compare LookML Packages types —
 * generated straight from the OpenAPI schema (backend/app/schemas/looker.py)
 * rather than hand-duplicated, matching the Parquet Reader convention.
 */
import type { components } from "@/types/generated/api";

export type PbipStructureResult = components["schemas"]["PbipStructureResult"];
export type PbipStructureStats = components["schemas"]["PbipStructureStats"];
export type LookmlPreviewResult = components["schemas"]["LookmlPreviewResult"];
export type LookmlCompareResult = components["schemas"]["LookmlCompareResult"];
export type LookmlCompareSummary = components["schemas"]["LookmlCompareSummary"];

/** Bulk PBIP -> LookML conversion types (Bulk Conversion mode of Convert PBIP to LookML). */
export type BulkDiscoverySummary = components["schemas"]["BulkDiscoverySummary"];
export type BulkInvalidProject = components["schemas"]["BulkInvalidProject"];
export type BulkJobStartResult = components["schemas"]["BulkJobStartResult"];
export type BulkJobStatusResult = components["schemas"]["BulkJobStatusResult"];
export type BulkJobSummaryResult = components["schemas"]["BulkJobSummaryResult"];
export type BulkProjectSuccess = components["schemas"]["BulkProjectSuccess"];
export type BulkProjectFailure = components["schemas"]["BulkProjectFailure"];
