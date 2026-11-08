"use client";

import { useCallback, useState } from "react";

import { buildProjectZip } from "@/features/looker/shared/project-zip";
import { scopeProject, type CollectedEntry } from "@/features/looker/shared/project-collector";
import { lookerService } from "@/services/looker-service";
import { IDLE_VALIDATION, type LookmlCompareResult, type PbipValidation } from "@/types/looker";

export interface CompareSlotSummary {
  displayName: string;
  fileCount: number;
  /** What kind of upload was recognized locally — the backend still auto-detects the real source type. */
  kind: "folder" | "zip";
}

interface SlotState {
  summary: CompareSlotSummary | null;
  mode: "pbip-folder" | "zip-file" | null;
  scopedEntries: CollectedEntry[];
  zipFile: File | null;
  projectName: string | null;
  validation: PbipValidation;
}

const INITIAL_SLOT: SlotState = {
  summary: null,
  mode: null,
  scopedEntries: [],
  zipFile: null,
  projectName: null,
  validation: IDLE_VALIDATION,
};

/** A single dropped/selected `.zip` file is treated as an already-generated LookML package,
 * uploaded as-is. Anything else (a folder's worth of entries) goes through the existing
 * PBIP project scoping + client-side zip flow, unchanged. */
function scopeSlot(entries: CollectedEntry[] | null): SlotState {
  if (!entries || entries.length === 0) return INITIAL_SLOT;

  if (entries.length === 1 && /\.zip$/i.test(entries[0].relativePath)) {
    const file = entries[0].file;
    return {
      summary: { displayName: file.name, fileCount: 1, kind: "zip" },
      mode: "zip-file",
      scopedEntries: [],
      zipFile: file,
      projectName: file.name.replace(/\.zip$/i, "") || "LookML Package",
      validation: { ...IDLE_VALIDATION, status: "valid" },
    };
  }

  const scoped = scopeProject(entries);
  const displayName = scoped.projectName ? `${scoped.projectName}.pbip` : "PBIP project";
  return {
    summary: { displayName, fileCount: entries.length, kind: "folder" },
    mode: "pbip-folder",
    scopedEntries: scoped.entries,
    zipFile: null,
    projectName: scoped.projectName || null,
    validation: scoped.validation,
  };
}

function isSlotReady(slot: SlotState): boolean {
  if (slot.mode === "zip-file") return Boolean(slot.zipFile);
  if (slot.mode === "pbip-folder") return Boolean(slot.projectName) && slot.validation.status === "valid";
  return false;
}

/** Manages the two independent upload slots the Compare module needs — each can hold either
 * a PBIP project (folder, zipped client-side) or an already-generated LookML package (a raw
 * .zip file sent through unchanged). The backend auto-detects which is which. */
export function useLookmlCompare() {
  const [slotA, setSlotA] = useState<SlotState>(INITIAL_SLOT);
  const [slotB, setSlotB] = useState<SlotState>(INITIAL_SLOT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookmlCompareResult | null>(null);

  const selectA = useCallback((entries: CollectedEntry[] | null) => {
    setSlotA(scopeSlot(entries));
    setResult(null);
  }, []);
  const selectB = useCallback((entries: CollectedEntry[] | null) => {
    setSlotB(scopeSlot(entries));
    setResult(null);
  }, []);

  const reset = useCallback(() => {
    setSlotA(INITIAL_SLOT);
    setSlotB(INITIAL_SLOT);
    setIsLoading(false);
    setError(null);
    setResult(null);
  }, []);

  const bothReady = isSlotReady(slotA) && isSlotReady(slotB);

  const run = useCallback(async () => {
    if (!bothReady || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const [zipA, zipB] = await Promise.all([
        slotA.mode === "zip-file" ? Promise.resolve(slotA.zipFile as File) : buildProjectZip(slotA.scopedEntries),
        slotB.mode === "zip-file" ? Promise.resolve(slotB.zipFile as File) : buildProjectZip(slotB.scopedEntries),
      ]);
      const nameA = slotA.mode === "zip-file" ? (slotA.zipFile as File).name : `${slotA.projectName}.zip`;
      const nameB = slotB.mode === "zip-file" ? (slotB.zipFile as File).name : `${slotB.projectName}.zip`;
      const diff = await lookerService.compareLookmlPackages(zipA, nameA, zipB, nameB);
      setResult(diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setIsLoading(false);
    }
  }, [bothReady, isLoading, slotA, slotB]);

  return {
    slotA: slotA.summary,
    slotB: slotB.summary,
    selectA,
    selectB,
    isLoading,
    error,
    setError,
    result,
    reset,
    run,
    bothReady,
  };
}

