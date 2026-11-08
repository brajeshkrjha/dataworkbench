"use client";

import { useCallback, useState } from "react";

import { downloadBlob } from "@/lib/download-blob";
import { parquetService } from "@/services/parquet-service";
import type { ComparisonExportFormat, SchemaComparisonResult } from "@/types/parquet";

interface ComparisonState {
  fileA: File | null;
  fileB: File | null;
  includeOrderChanges: boolean;
  isComparing: boolean;
  error: string | null;
  result: SchemaComparisonResult | null;
  isExporting: boolean;
}

const INITIAL_STATE: ComparisonState = {
  fileA: null,
  fileB: null,
  includeOrderChanges: false,
  isComparing: false,
  error: null,
  result: null,
  isExporting: false,
};

/** Manages the Schema Comparison workspace: two file uploads, one compare
 * call, and export - fully stateless on the backend (no session id). */
export function useSchemaComparison() {
  const [state, setState] = useState<ComparisonState>(INITIAL_STATE);

  const selectFileA = useCallback((file: File | null) => {
    setState((previous) => ({ ...previous, fileA: file, result: null, error: null }));
  }, []);

  const selectFileB = useCallback((file: File | null) => {
    setState((previous) => ({ ...previous, fileB: file, result: null, error: null }));
  }, []);

  const setIncludeOrderChanges = useCallback((value: boolean) => {
    setState((previous) => ({ ...previous, includeOrderChanges: value, result: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error }));
  }, []);

  const compare = useCallback(async () => {
    const { fileA, fileB, includeOrderChanges, isComparing } = state;
    if (!fileA || !fileB || isComparing) return;

    setState((previous) => ({ ...previous, isComparing: true, error: null }));
    try {
      const result = await parquetService.compareSchemas(fileA, fileB, includeOrderChanges);
      setState((previous) => ({ ...previous, isComparing: false, result }));
    } catch (err) {
      setState((previous) => ({
        ...previous,
        isComparing: false,
        error: err instanceof Error ? err.message : "Failed to compare schemas.",
      }));
    }
  }, [state]);

  const exportReport = useCallback(
    async (format: ComparisonExportFormat) => {
      if (!state.result) return;
      setState((previous) => ({ ...previous, isExporting: true }));
      try {
        const blob = await parquetService.exportComparisonReport(state.result, format);
        const extension = format === "markdown" ? "md" : "csv";
        downloadBlob(blob, `schema-comparison.${extension}`);
      } catch (err) {
        setState((previous) => ({
          ...previous,
          error: err instanceof Error ? err.message : "Failed to export report.",
        }));
      } finally {
        setState((previous) => ({ ...previous, isExporting: false }));
      }
    },
    [state.result]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    hasResult: state.result !== null,
    selectFileA,
    selectFileB,
    setIncludeOrderChanges,
    setError,
    compare,
    exportReport,
    reset,
  };
}
