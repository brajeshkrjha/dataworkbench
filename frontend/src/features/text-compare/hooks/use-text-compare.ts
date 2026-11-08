"use client";

import { useCallback, useState } from "react";

import { downloadBlob } from "@/lib/download-blob";
import { textCompareService } from "@/services/text-compare-service";
import type { ComparisonExportFormat, ComparisonInputType, ComparisonResult } from "@/types/text-compare";

interface TextCompareState {
  fileA: File | null;
  textA: string;
  fileB: File | null;
  textB: string;
  typeOverride: ComparisonInputType | null;
  isComparing: boolean;
  isExporting: boolean;
  error: string | null;
  result: ComparisonResult | null;
}

const INITIAL_STATE: TextCompareState = {
  fileA: null,
  textA: "",
  fileB: null,
  textB: "",
  typeOverride: null,
  isComparing: false,
  isExporting: false,
  error: null,
  result: null,
};

/** Manages the Text Compare workspace: two inputs (each upload or paste),
 * one stateless compare call, and export - no backend session. */
export function useTextCompare() {
  const [state, setState] = useState<TextCompareState>(INITIAL_STATE);

  const setFileA = useCallback((file: File | null) => {
    setState((previous) => ({ ...previous, fileA: file, textA: "", result: null, error: null }));
  }, []);

  const setTextA = useCallback((text: string) => {
    setState((previous) => ({ ...previous, textA: text, fileA: null, result: null, error: null }));
  }, []);

  const setFileB = useCallback((file: File | null) => {
    setState((previous) => ({ ...previous, fileB: file, textB: "", result: null, error: null }));
  }, []);

  const setTextB = useCallback((text: string) => {
    setState((previous) => ({ ...previous, textB: text, fileB: null, result: null, error: null }));
  }, []);

  const setTypeOverride = useCallback((type: ComparisonInputType | null) => {
    setState((previous) => ({ ...previous, typeOverride: type, result: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error }));
  }, []);

  const hasInputA = state.fileA !== null || state.textA.trim() !== "";
  const hasInputB = state.fileB !== null || state.textB.trim() !== "";

  const compare = useCallback(async () => {
    if (!hasInputA || !hasInputB || state.isComparing) return;

    setState((previous) => ({ ...previous, isComparing: true, error: null }));
    try {
      const result = await textCompareService.compare({
        fileA: state.fileA,
        textA: state.textA,
        fileB: state.fileB,
        textB: state.textB,
        typeOverride: state.typeOverride,
      });
      setState((previous) => ({ ...previous, isComparing: false, result }));
    } catch (err) {
      setState((previous) => ({
        ...previous,
        isComparing: false,
        error: err instanceof Error ? err.message : "Failed to compare content.",
      }));
    }
  }, [hasInputA, hasInputB, state.isComparing, state.fileA, state.textA, state.fileB, state.textB, state.typeOverride]);

  const exportReport = useCallback(
    async (format: ComparisonExportFormat) => {
      if (!state.result) return;
      setState((previous) => ({ ...previous, isExporting: true }));
      try {
        const blob = await textCompareService.exportReport(state.result, format);
        const extension = format === "markdown" ? "md" : "csv";
        downloadBlob(blob, `text-comparison.${extension}`);
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
    hasInputA,
    hasInputB,
    hasResult: state.result !== null,
    setFileA,
    setTextA,
    setFileB,
    setTextB,
    setTypeOverride,
    setError,
    compare,
    exportReport,
    reset,
  };
}
