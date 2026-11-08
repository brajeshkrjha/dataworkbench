/**
 * Service layer for the GCP Looker Utility API. All Looker-related
 * network access goes through this module.
 */
import { apiGet, apiGetBlob, apiPostForm, apiPostFormForBlob } from "@/services/api-client";
import type {
  BulkJobStartResult,
  BulkJobStatusResult,
  BulkJobSummaryResult,
  ConvertedLookerPackage,
  LookerConversionResult,
  LookmlCompareResult,
  LookmlPreviewResult,
  PbipStructureResult,
} from "@/types/looker";

const BASE_PATH = "/tools/gcp-looker-utility";

function parseFileNameFromContentDisposition(headers: Headers, fallback: string): string {
  const disposition = headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] ?? fallback;
}

function readResultHeaders(headers: Headers, outputFileName: string): LookerConversionResult {
  return {
    projectName: headers.get("X-Looker-Project-Name") ?? outputFileName,
    outputFileName,
    viewsGenerated: Number(headers.get("X-Looker-Views-Generated") ?? 0),
    exploresGenerated: Number(headers.get("X-Looker-Explores-Generated") ?? 0),
    relationshipsFound: Number(headers.get("X-Looker-Relationships-Found") ?? 0),
    measuresFound: Number(headers.get("X-Looker-Measures-Found") ?? 0),
  };
}

export const lookerService = {
  /**
   * Sends a packaged PBIP project to the backend for conversion. The
   * backend endpoint still expects a ZIP archive — that packaging is an
   * internal transport detail built client-side from the user's selected
   * PBIP project folder (see project-collector.ts / zip-writer.ts), never
   * something the user chooses or sees.
   */
  async convertPbipToLookml(zipBlob: Blob, projectName: string): Promise<ConvertedLookerPackage> {
    const formData = new FormData();
    formData.append("file", zipBlob, `${projectName}.zip`);

    const { blob, headers } = await apiPostFormForBlob(`${BASE_PATH}/convert`, formData);
    const fallbackName = `${projectName}_LookML.zip`;
    const outputFileName = parseFileNameFromContentDisposition(headers, fallbackName);

    return { blob, result: readResultHeaders(headers, outputFileName) };
  },

  /** Structural breakdown of a PBIP project (tables, measures, relationships, lineage, stats). */
  async explorePbipStructure(zipBlob: Blob, projectName: string): Promise<PbipStructureResult> {
    const formData = new FormData();
    formData.append("file", zipBlob, `${projectName}.zip`);
    return apiPostForm<PbipStructureResult>(`${BASE_PATH}/explore`, formData);
  },

  /** Structured LookML (model + per-view + per-explore) for in-browser preview. */
  async previewLookml(zipBlob: Blob, projectName: string): Promise<LookmlPreviewResult> {
    const formData = new FormData();
    formData.append("file", zipBlob, `${projectName}.zip`);
    return apiPostForm<LookmlPreviewResult>(`${BASE_PATH}/preview`, formData);
  },

  /**
   * Structural diff between two uploads — each independently a PBIP project
   * (zipped client-side) or an already-generated LookML package (a raw .zip
   * sent through as-is). The backend auto-detects each side's source type;
   * this method just needs the two ZIP blobs and the filenames to send them
   * under (already including any `.zip` extension).
   */
  async compareLookmlPackages(
    zipBlobA: Blob,
    fileNameA: string,
    zipBlobB: Blob,
    fileNameB: string
  ): Promise<LookmlCompareResult> {
    const formData = new FormData();
    formData.append("file_a", zipBlobA, fileNameA);
    formData.append("file_b", zipBlobB, fileNameB);
    return apiPostForm<LookmlCompareResult>(`${BASE_PATH}/compare`, formData);
  },

  /**
   * Starts a bulk conversion job for a parent-folder ZIP containing many PBIP
   * project subfolders. Returns immediately with a job id and the discovery
   * summary (found/valid/invalid) — actual conversion runs in the background
   * on the server; poll `getBulkConvertStatus` for progress.
   */
  async startBulkConvert(zipBlob: Blob, fileName: string): Promise<BulkJobStartResult> {
    const formData = new FormData();
    formData.append("file", zipBlob, fileName);
    return apiPostForm<BulkJobStartResult>(`${BASE_PATH}/bulk-convert`, formData);
  },

  /** Progress snapshot for a running bulk conversion job (processed/total/current project). */
  async getBulkConvertStatus(jobId: string): Promise<BulkJobStatusResult> {
    return apiGet<BulkJobStatusResult>(`${BASE_PATH}/bulk-convert/${jobId}/status`);
  },

  /** Final (or in-progress) success/failure breakdown for a bulk conversion job. */
  async getBulkConvertSummary(jobId: string): Promise<BulkJobSummaryResult> {
    return apiGet<BulkJobSummaryResult>(`${BASE_PATH}/bulk-convert/${jobId}/summary`);
  },

  /** The completed bulk conversion output — one ZIP with each project in its own subfolder. */
  async downloadBulkConvertZip(jobId: string): Promise<Blob> {
    return apiGetBlob(`${BASE_PATH}/bulk-convert/${jobId}/download`);
  },

  /** A downloadable Markdown summary report for a bulk conversion job. */
  async downloadBulkConvertReport(jobId: string): Promise<Blob> {
    return apiGetBlob(`${BASE_PATH}/bulk-convert/${jobId}/report`);
  },
};
