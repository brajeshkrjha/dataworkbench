"use client";

import { useCallback, useEffect, useState } from "react";

import type { RowLimit } from "@/features/parquet/modules/reader/constants";
import { parquetService } from "@/services/parquet-service";
import { useParquetHandoffStore, type ParquetHandoffOrigin } from "@/store/use-parquet-handoff-store";
import type { ColumnSchema, ParquetFileMetadata } from "@/types/parquet";

interface ReaderState {
  file: File | null;
  origin: ParquetHandoffOrigin | null;
  isUploading: boolean;
  isLoadingRows: boolean;
  error: string | null;
  fileId: string | null;
  metadata: ParquetFileMetadata | null;
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  totalRowCount: number;
  offset: number;
  limit: RowLimit;
}

const INITIAL_STATE: ReaderState = {
  file: null,
  origin: null,
  isUploading: false,
  isLoadingRows: false,
  error: null,
  fileId: null,
  metadata: null,
  columns: [],
  rows: [],
  totalRowCount: 0,
  offset: 0,
  limit: 100,
};

export function useParquetReader() {
  const [state, setState] = useState<ReaderState>(INITIAL_STATE);

  const fetchRows = useCallback(async (fileId: string, offset: number, limit: number) => {
    setState((previous) => ({ ...previous, isLoadingRows: true }));
    try {
      const page = await parquetService.getReaderRows(fileId, offset, limit);
      setState((previous) => ({
        ...previous,
        isLoadingRows: false,
        rows: page.rows,
        totalRowCount: page.total_row_count,
        offset: page.offset,
        limit: page.limit as RowLimit,
      }));
    } catch (err) {
      setState((previous) => ({
        ...previous,
        isLoadingRows: false,
        error: err instanceof Error ? err.message : "Failed to load rows.",
      }));
    }
  }, []);

  const selectFile = useCallback((file: File | null, origin: ParquetHandoffOrigin | null = null) => {
    setState({ ...INITIAL_STATE, file, origin });
  }, []);

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error }));
  }, []);

  const upload = useCallback(
    async (fileOverride?: File) => {
      const file = fileOverride ?? state.file;
      if (!file) return;

      setState((previous) => ({ ...previous, isUploading: true, error: null }));
      try {
        const result = await parquetService.uploadForReading(file);
        setState((previous) => ({
          ...previous,
          isUploading: false,
          fileId: result.file_id,
          metadata: result.metadata,
          columns: result.columns,
        }));
        await fetchRows(result.file_id, 0, INITIAL_STATE.limit);
      } catch (err) {
        setState((previous) => ({
          ...previous,
          isUploading: false,
          error: err instanceof Error ? err.message : "Failed to read parquet file.",
        }));
      }
    },
    [state.file, fetchRows]
  );

  const goToPage = useCallback(
    (offset: number) => {
      if (!state.fileId) return;
      void fetchRows(state.fileId, offset, state.limit);
    },
    [state.fileId, state.limit, fetchRows]
  );

  const setLimit = useCallback(
    (limit: RowLimit) => {
      if (!state.fileId) return;
      void fetchRows(state.fileId, 0, limit);
    },
    [state.fileId, fetchRows]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // Auto-preload: if another module (e.g. Convert Files) just handed off a
  // generated parquet file, load it immediately instead of asking the user
  // to upload it again. If there's no pending handoff, this is a no-op and
  // the reader falls back to its normal empty-upload state.
  useEffect(() => {
    const pending = useParquetHandoffStore.getState().consumePending();
    if (!pending) return;

    const file = new File([pending.blob], pending.fileName, {
      type: "application/octet-stream",
    });
    selectFile(file, pending.origin);
    void upload(file);
  }, [selectFile, upload]);

  return {
    ...state,
    hasResult: state.fileId !== null,
    selectFile,
    setError,
    upload,
    goToPage,
    setLimit,
    reset,
  };
}
