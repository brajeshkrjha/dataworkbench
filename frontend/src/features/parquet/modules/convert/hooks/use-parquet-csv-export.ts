"use client";

import { useParquetCsvExportStore } from "@/store/use-parquet-csv-export-store";

/**
 * Thin selector wrapper around the module-level CSV export store, mirroring
 * `use-parquet-conversion.ts`'s shape for the "To Parquet" direction.
 */
export function useParquetCsvExport() {
  const state = useParquetCsvExportStore();

  // Unfinished work = a file is selected but the export hasn't been
  // downloaded yet. Cleared once downloaded, or when there's no file.
  const hasUnsavedWork = Boolean(state.file) && !state.hasDownloaded;

  return { ...state, hasUnsavedWork };
}
