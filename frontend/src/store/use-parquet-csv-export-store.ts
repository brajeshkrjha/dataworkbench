"use client";

import { create } from "zustand";

import {
  DEFAULT_CSV_DELIMITER,
  DEFAULT_CSV_QUOTING,
} from "@/features/parquet/modules/convert/constants";
import { parquetService } from "@/services/parquet-service";
import type {
  ColumnSchema,
  CsvDelimiter,
  CsvQuoting,
  ParquetFileMetadata,
  ParquetToCsvResult,
} from "@/types/parquet";

interface CsvExportState {
  file: File | null;
  isUploading: boolean;
  fileId: string | null;
  metadata: ParquetFileMetadata | null;
  columns: ColumnSchema[];
  delimiter: CsvDelimiter;
  includeHeader: boolean;
  quoting: CsvQuoting;
  outputFileName: string;
  isExporting: boolean;
  error: string | null;
  result: ParquetToCsvResult | null;
  resultBlob: Blob | null;
  downloadUrl: string | null;
  hasDownloaded: boolean;
}

interface CsvExportStore extends CsvExportState {
  selectFile: (file: File | null) => void;
  setDelimiter: (delimiter: CsvDelimiter) => void;
  setIncludeHeader: (includeHeader: boolean) => void;
  setQuoting: (quoting: CsvQuoting) => void;
  setOutputFileName: (outputFileName: string) => void;
  setError: (error: string) => void;
  markDownloaded: () => void;
  loadPreview: (fileOverride?: File) => Promise<void>;
  exportCsv: () => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: CsvExportState = {
  file: null,
  isUploading: false,
  fileId: null,
  metadata: null,
  columns: [],
  delimiter: DEFAULT_CSV_DELIMITER,
  includeHeader: true,
  quoting: DEFAULT_CSV_QUOTING,
  outputFileName: "",
  isExporting: false,
  error: null,
  result: null,
  resultBlob: null,
  downloadUrl: null,
  hasDownloaded: false,
};

function revokeUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Module-level (Zustand) state for the "From Parquet" (-> CSV) direction of
 * Convert Files. Mirrors `use-parquet-conversion-store.ts`'s structure and
 * survives unmount/remount across client-side navigation (e.g. "Open in
 * Parquet Reader" and back), for the same reasons documented there.
 */
export const useParquetCsvExportStore = create<CsvExportStore>()((set, get) => ({
  ...INITIAL_STATE,

  selectFile: (file) => {
    revokeUrl(get().downloadUrl);
    set({
      ...INITIAL_STATE,
      file,
    });
  },

  setDelimiter: (delimiter) => set({ delimiter }),
  setIncludeHeader: (includeHeader) => set({ includeHeader }),
  setQuoting: (quoting) => set({ quoting }),
  setOutputFileName: (outputFileName) => set({ outputFileName }),

  setError: (error) => set({ error, result: null }),

  markDownloaded: () => set({ hasDownloaded: true }),

  reset: () => {
    revokeUrl(get().downloadUrl);
    set(INITIAL_STATE);
  },

  loadPreview: async (fileOverride) => {
    const file = fileOverride ?? get().file;
    if (!file) return;

    set({ isUploading: true, error: null });
    try {
      const uploadResult = await parquetService.uploadForCsvExport(file);
      set({
        isUploading: false,
        fileId: uploadResult.file_id,
        metadata: uploadResult.metadata,
        columns: uploadResult.columns,
      });
    } catch (err) {
      set({
        isUploading: false,
        error: err instanceof Error ? err.message : "Failed to validate parquet file.",
      });
    }
  },

  exportCsv: async () => {
    const { fileId, delimiter, includeHeader, quoting, outputFileName } = get();
    if (!fileId) return;

    revokeUrl(get().downloadUrl);
    set({
      isExporting: true,
      error: null,
      result: null,
      resultBlob: null,
      downloadUrl: null,
      hasDownloaded: false,
    });

    try {
      const { blob, result } = await parquetService.exportParquetToCsv(fileId, {
        delimiter,
        includeHeader,
        quoting,
        outputFileName,
      });
      const url = URL.createObjectURL(blob);
      set({
        isExporting: false,
        result,
        resultBlob: blob,
        downloadUrl: url,
      });
    } catch (err) {
      set({
        isExporting: false,
        error: err instanceof Error ? err.message : "Export failed.",
      });
    }
  },
}));
