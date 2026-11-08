"use client";

import { useCallback, useRef, useState } from "react";

import { parquetService } from "@/services/parquet-service";
import type {
  ColumnProfile,
  ColumnSchema,
  ParquetFileMetadata,
  ParquetSample,
  ParquetStatistics,
  SampleMode,
  StorageAnalysis,
} from "@/types/parquet";

interface AnalyzerState {
  file: File | null;
  isUploading: boolean;
  error: string | null;
  fileId: string | null;
  overview: ParquetFileMetadata | null;
  columns: ColumnSchema[];
  statistics: ParquetStatistics | null;
  isLoadingStatistics: boolean;
  storage: StorageAnalysis | null;
  isLoadingStorage: boolean;
  sample: ParquetSample | null;
  isLoadingSample: boolean;
  selectedColumn: string | null;
  profile: ColumnProfile | null;
  isLoadingProfile: boolean;
}

const INITIAL_STATE: AnalyzerState = {
  file: null,
  isUploading: false,
  error: null,
  fileId: null,
  overview: null,
  columns: [],
  statistics: null,
  isLoadingStatistics: false,
  storage: null,
  isLoadingStorage: false,
  sample: null,
  isLoadingSample: false,
  selectedColumn: null,
  profile: null,
  isLoadingProfile: false,
};

/**
 * Manages the Parquet Analyzer workspace: one upload, then every tab
 * (Overview/Schema/Statistics/Profiling/Sampling/Storage) lazily fetches its
 * own view of the same server-side session — nothing is fetched until its
 * tab is opened, keeping the initial upload response fast regardless of
 * file size or column count.
 */
export function useParquetAnalyzer() {
  const [state, setState] = useState<AnalyzerState>(INITIAL_STATE);
  const pendingStatistics = useRef<string | null>(null);
  const pendingStorage = useRef<string | null>(null);
  const sampleRequest = useRef(0);
  const profileRequest = useRef(0);

  // Follow-up responses belong only to the file that requested them, not
  // to a new upload selected while the request was still in flight.
  const updateSession = useCallback((fileId: string, patch: Partial<AnalyzerState>) => {
    setState((previous) => previous.fileId === fileId ? { ...previous, ...patch } : previous);
  }, []);

  const selectFile = useCallback((file: File | null) => {
    setState({ ...INITIAL_STATE, file });
  }, []);

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error }));
  }, []);

  const upload = useCallback(async () => {
    const file = state.file;
    if (!file || state.isUploading) return;

    setState((previous) => ({ ...previous, isUploading: true, error: null }));
    try {
      const result = await parquetService.uploadForAnalysis(file);
      setState((previous) => previous.file === file ? ({
        ...previous,
        isUploading: false,
        fileId: result.file_id,
        overview: result.metadata,
        columns: result.columns,
      }) : previous);
    } catch (err) {
      setState((previous) => previous.file === file ? ({
        ...previous,
        isUploading: false,
        error: err instanceof Error ? err.message : "Failed to read parquet file.",
      }) : previous);
    }
  }, [state.file, state.isUploading]);

  const loadStatistics = useCallback(async () => {
    const fileId = state.fileId;
    if (!fileId || state.statistics || pendingStatistics.current === fileId) return;
    pendingStatistics.current = fileId;
    updateSession(fileId, { isLoadingStatistics: true });
    try {
      const statistics = await parquetService.getAnalyzerStatistics(fileId);
      updateSession(fileId, { isLoadingStatistics: false, statistics });
    } catch (err) {
      updateSession(fileId, {
        isLoadingStatistics: false,
        error: err instanceof Error ? err.message : "Failed to load statistics.",
      });
    } finally {
      if (pendingStatistics.current === fileId) pendingStatistics.current = null;
    }
  // Loading flags must not invalidate the callback: the tab effect would
  // otherwise retry immediately on every failure, creating a request loop.
  }, [state.fileId, state.statistics, updateSession]);

  const loadStorage = useCallback(async () => {
    const fileId = state.fileId;
    if (!fileId || state.storage || pendingStorage.current === fileId) return;
    pendingStorage.current = fileId;
    updateSession(fileId, { isLoadingStorage: true });
    try {
      const storage = await parquetService.getAnalyzerStorage(fileId);
      updateSession(fileId, { isLoadingStorage: false, storage });
    } catch (err) {
      updateSession(fileId, {
        isLoadingStorage: false,
        error: err instanceof Error ? err.message : "Failed to load storage analysis.",
      });
    } finally {
      if (pendingStorage.current === fileId) pendingStorage.current = null;
    }
  }, [state.fileId, state.storage, updateSession]);

  const loadSample = useCallback(
    async (mode: SampleMode, size: number) => {
      const fileId = state.fileId;
      if (!fileId) return;
      const request = ++sampleRequest.current;
      updateSession(fileId, { isLoadingSample: true });
      try {
        const sample = await parquetService.getAnalyzerSample(fileId, mode, size);
        if (sampleRequest.current !== request) return;
        updateSession(fileId, { isLoadingSample: false, sample });
      } catch (err) {
        if (sampleRequest.current !== request) return;
        updateSession(fileId, {
          isLoadingSample: false,
          error: err instanceof Error ? err.message : "Failed to load sample.",
        });
      }
    },
    [state.fileId, updateSession]
  );

  const selectColumn = useCallback(
    async (columnName: string) => {
      const fileId = state.fileId;
      if (!fileId) return;
      const request = ++profileRequest.current;
      updateSession(fileId, {
        selectedColumn: columnName,
        profile: null,
        isLoadingProfile: true,
      });
      try {
        const profile = await parquetService.getAnalyzerColumnProfile(fileId, columnName);
        if (profileRequest.current !== request) return;
        updateSession(fileId, { isLoadingProfile: false, profile });
      } catch (err) {
        if (profileRequest.current !== request) return;
        updateSession(fileId, {
          isLoadingProfile: false,
          error: err instanceof Error ? err.message : "Failed to load column profile.",
        });
      }
    },
    [state.fileId, updateSession]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    hasResult: state.fileId !== null,
    selectFile,
    setError,
    upload,
    loadStatistics,
    loadStorage,
    loadSample,
    selectColumn,
    reset,
  };
}
