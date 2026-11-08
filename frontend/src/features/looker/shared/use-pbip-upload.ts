"use client";

import { useCallback, useState } from "react";

import type { SelectedProjectSummary } from "@/features/looker/modules/convert/components/file-drop-zone";
import { scopeProject, type CollectedEntry } from "@/features/looker/shared/project-collector";
import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { IDLE_VALIDATION, type PbipValidation } from "@/types/looker";

interface UploadState<T> {
  project: SelectedProjectSummary | null;
  projectName: string | null;
  scopedEntries: CollectedEntry[];
  validation: PbipValidation;
  isLoading: boolean;
  error: string | null;
  result: T | null;
}

function initialState<T>(): UploadState<T> {
  return {
    project: null,
    projectName: null,
    scopedEntries: [],
    validation: IDLE_VALIDATION,
    isLoading: false,
    error: null,
    result: null,
  };
}

/**
 * Generic "select a PBIP project folder, zip it client-side, POST it to a
 * Looker endpoint" hook shared by the Explore, Preview, and Compare
 * modules so none of them re-implement project scoping/zipping/error
 * handling that Convert already established.
 */
export function usePbipUpload<T>(apiCall: (zip: Blob, projectName: string) => Promise<T>) {
  const [state, setState] = useState<UploadState<T>>(() => initialState<T>());

  const selectEntries = useCallback((entries: CollectedEntry[] | null) => {
    if (!entries || entries.length === 0) {
      setState(initialState<T>());
      return;
    }
    const scoped = scopeProject(entries);
    const displayName = scoped.projectName ? `${scoped.projectName}.pbip` : "PBIP project";
    setState({
      ...initialState<T>(),
      project: { displayName, fileCount: entries.length },
      projectName: scoped.projectName || null,
      scopedEntries: scoped.entries,
      validation: scoped.validation,
    });
  }, []);

  const setError = useCallback((error: string) => {
    setState((previous) => ({ ...previous, error, result: null }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState<T>());
  }, []);

  const run = useCallback(async () => {
    const { scopedEntries, projectName, validation, isLoading } = state;
    if (!projectName || isLoading || validation.status !== "valid") return;
    if (scopedEntries.length === 0) return;

    setState((previous) => ({ ...previous, isLoading: true, error: null, result: null }));
    try {
      const zip = await buildProjectZip(scopedEntries);
      const result = await apiCall(zip, projectName);
      setState((previous) => ({ ...previous, isLoading: false, result }));
    } catch (err) {
      setState((previous) => ({
        ...previous,
        isLoading: false,
        error: err instanceof Error ? err.message : "Request failed.",
      }));
    }
  }, [state, apiCall]);

  return { ...state, selectEntries, setError, reset, run };
}
