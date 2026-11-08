"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SelectedProjectSummary } from "@/features/looker/modules/convert/components/file-drop-zone";
import { scopeProject, type CollectedEntry } from "@/features/looker/shared/project-collector";
import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { lookerService } from "@/services/looker-service";
import { IDLE_VALIDATION, type LookerConversionResult, type PbipValidation } from "@/types/looker";

interface ConversionState {
  project: SelectedProjectSummary | null;
  projectName: string | null;
  scopedEntries: CollectedEntry[];
  validation: PbipValidation;
  isConverting: boolean;
  error: string | null;
  result: LookerConversionResult | null;
  downloadUrl: string | null;
  hasDownloaded: boolean;
}

const INITIAL_STATE: ConversionState = {
  project: null,
  projectName: null,
  scopedEntries: [],
  validation: IDLE_VALIDATION,
  isConverting: false,
  error: null,
  result: null,
  downloadUrl: null,
  hasDownloaded: false,
};

export function useLookerConversion() {
  const [state, setState] = useState<ConversionState>(INITIAL_STATE);
  const downloadUrlRef = useRef<string | null>(null);

  const revokeDownloadUrl = useCallback(() => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
  }, []);

  useEffect(() => revokeDownloadUrl, [revokeDownloadUrl]);

  const selectEntries = useCallback(
    (entries: CollectedEntry[] | null) => {
      revokeDownloadUrl();

      if (!entries || entries.length === 0) {
        setState(INITIAL_STATE);
        return;
      }

      const scoped = scopeProject(entries);
      const displayName = scoped.projectName ? `${scoped.projectName}.pbip` : "PBIP project";

      setState({
        ...INITIAL_STATE,
        project: { displayName, fileCount: entries.length },
        projectName: scoped.projectName || null,
        scopedEntries: scoped.entries,
        validation: scoped.validation,
      });
    },
    [revokeDownloadUrl]
  );

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error, result: null }));
  }, []);

  const markDownloaded = useCallback(() => {
    setState((previous) => ({ ...previous, hasDownloaded: true }));
  }, []);

  const reset = useCallback(() => {
    revokeDownloadUrl();
    setState(INITIAL_STATE);
  }, [revokeDownloadUrl]);

  const convert = useCallback(async () => {
    const { scopedEntries, projectName, validation, isConverting } = state;
    if (!projectName || isConverting || validation.status !== "valid") return;
    if (scopedEntries.length === 0) return;

    revokeDownloadUrl();
    setState((previous) => ({
      ...previous,
      isConverting: true,
      error: null,
      result: null,
      downloadUrl: null,
      hasDownloaded: false,
    }));

    try {
      const payload = await buildProjectZip(scopedEntries);
      const { blob, result } = await lookerService.convertPbipToLookml(payload, projectName);
      const url = URL.createObjectURL(blob);
      downloadUrlRef.current = url;
      setState((previous) => ({
        ...previous,
        isConverting: false,
        result,
        downloadUrl: url,
      }));
    } catch (err) {
      setState((previous) => ({
        ...previous,
        isConverting: false,
        error: err instanceof Error ? err.message : "Conversion failed.",
      }));
    }
  }, [state, revokeDownloadUrl]);

  // Unfinished work = a project is selected but the resulting LookML
  // package hasn't been downloaded yet. Cleared once downloaded, or when
  // there's no project at all.
  const hasUnsavedWork = Boolean(state.project) && !state.hasDownloaded;

  return {
    ...state,
    hasUnsavedWork,
    selectEntries,
    setError,
    markDownloaded,
    convert,
    reset,
  };
}
