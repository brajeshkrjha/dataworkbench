"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { scopeBulkEntries, type CollectedEntry } from "@/features/looker/shared/project-collector";
import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { downloadBlob } from "@/lib/download-blob";
import { lookerService } from "@/services/looker-service";
import type { BulkDiscoverySummary, BulkJobStatusResult, BulkJobSummaryResult } from "@/types/looker";

export interface BulkFolderSummary {
  displayName: string;
  fileCount: number;
}

const POLL_INTERVAL_MS = 700;

/**
 * Manages the Bulk Conversion flow: parent-folder upload -> discovery ->
 * background conversion (polled) -> summary + downloads. Reuses the same
 * client-side zipping (`buildProjectZip`) and exclusion rules
 * (`scopeBulkEntries`) the single-project flow already established; only
 * "one project" vs "many projects, let the server sort them out" differs.
 */
export function useBulkConversion() {
  const [folder, setFolder] = useState<BulkFolderSummary | null>(null);
  const [scopedEntries, setScopedEntries] = useState<CollectedEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<BulkDiscoverySummary | null>(null);
  const [status, setStatus] = useState<BulkJobStatusResult | null>(null);
  const [summary, setSummary] = useState<BulkJobSummaryResult | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const pollHandle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);
  const isStarting = useRef(false);

  const stopPolling = useCallback(() => {
    // Invalidate in-flight work too: clearing only the timer cannot stop an
    // already-awaited response from scheduling another poll after reset/unmount.
    runId.current += 1;
    isStarting.current = false;
    if (pollHandle.current !== null) {
      clearTimeout(pollHandle.current);
      pollHandle.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const selectEntries = useCallback((entries: CollectedEntry[] | null) => {
    stopPolling();
    setIsUploading(false);
    if (!entries || entries.length === 0) {
      setFolder(null);
      setScopedEntries([]);
    } else {
      const scoped = scopeBulkEntries(entries);
      setFolder({ displayName: "Parent folder", fileCount: scoped.length });
      setScopedEntries(scoped);
    }
    setError(null);
    setJobId(null);
    setDiscovery(null);
    setStatus(null);
    setSummary(null);
    setHasDownloaded(false);
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setFolder(null);
    setScopedEntries([]);
    setIsUploading(false);
    setError(null);
    setJobId(null);
    setDiscovery(null);
    setStatus(null);
    setSummary(null);
    setHasDownloaded(false);
  }, [stopPolling]);

  const poll = useCallback(
    (currentJobId: string, currentRun: number) => {
      const tick = async () => {
        if (runId.current !== currentRun) return;
        try {
          const nextStatus = await lookerService.getBulkConvertStatus(currentJobId);
          if (runId.current !== currentRun) return;
          setStatus(nextStatus);
          if (nextStatus.status === "completed" || nextStatus.status === "failed") {
            const finalSummary = await lookerService.getBulkConvertSummary(currentJobId);
            if (runId.current !== currentRun) return;
            setSummary(finalSummary);
            return;
          }
          pollHandle.current = setTimeout(() => void tick(), POLL_INTERVAL_MS);
        } catch (err) {
          if (runId.current !== currentRun) return;
          setError(err instanceof Error ? err.message : "Failed to check bulk conversion progress.");
        }
      };
      void tick();
    },
    []
  );

  const start = useCallback(async () => {
    if (scopedEntries.length === 0 || isUploading || isStarting.current) return;
    stopPolling();
    const currentRun = runId.current;
    isStarting.current = true;
    setIsUploading(true);
    setError(null);
    setJobId(null);
    setDiscovery(null);
    setStatus(null);
    setSummary(null);
    setHasDownloaded(false);
    try {
      const zip = await buildProjectZip(scopedEntries);
      if (runId.current !== currentRun) return;
      const started = await lookerService.startBulkConvert(zip, "bulk-upload.zip");
      if (runId.current !== currentRun) return;
      setJobId(started.job_id);
      setDiscovery(started.discovery);
      setIsUploading(false);
      if (started.discovery.valid > 0) {
        poll(started.job_id, currentRun);
      } else {
        setStatus({
          job_id: started.job_id,
          status: "completed",
          total: 0,
          processed: 0,
          current_project: null,
          percent: 100,
        });
        const finalSummary = await lookerService.getBulkConvertSummary(started.job_id);
        if (runId.current !== currentRun) return;
        setSummary(finalSummary);
      }
    } catch (err) {
      if (runId.current !== currentRun) return;
      setIsUploading(false);
      setError(err instanceof Error ? err.message : "Bulk conversion failed to start.");
    } finally {
      if (runId.current === currentRun) isStarting.current = false;
    }
  }, [scopedEntries, isUploading, poll, stopPolling]);

  const downloadZip = useCallback(async () => {
    if (!jobId) return;
    const blob = await lookerService.downloadBulkConvertZip(jobId);
    downloadBlob(blob, "Generated_LookML_Projects.zip");
    setHasDownloaded(true);
  }, [jobId]);

  const downloadReport = useCallback(async () => {
    if (!jobId) return;
    const blob = await lookerService.downloadBulkConvertReport(jobId);
    downloadBlob(blob, "Bulk_Conversion_Report.md");
  }, [jobId]);

  const isProcessing = status !== null && status.status === "processing";
  const isCompleted = status !== null && (status.status === "completed" || status.status === "failed");

  // Work in progress (a folder is selected, an upload/conversion is running)
  // or a finished job whose output hasn't been downloaded yet - in every
  // case, reloading would lose it. Mirrors the single-project hook's
  // "project selected" -> unsaved-work semantics.
  const hasUnsavedWork = Boolean(folder) || isUploading || isProcessing || (jobId !== null && !hasDownloaded);

  return {
    folder,
    isUploading,
    isProcessing,
    isCompleted,
    hasUnsavedWork,
    error,
    setError,
    jobId,
    discovery,
    status,
    summary,
    selectEntries,
    start,
    reset,
    downloadZip,
    downloadReport,
    canStart: scopedEntries.length > 0 && !isUploading && !jobId,
  };
}
