"use client";

import { create } from "zustand";

/**
 * Origins that can hand a generated parquet file off to another Parquet
 * Utility module. Extend this union (Reader today; Schema Explorer,
 * Metadata Explorer, Statistics later) without touching the store itself.
 */
export type ParquetHandoffOrigin = "convert";

export interface PendingParquetFile {
  blob: Blob;
  fileName: string;
  origin: ParquetHandoffOrigin;
}

interface ParquetHandoffState {
  pending: PendingParquetFile | null;
  setPending: (file: PendingParquetFile) => void;
  consumePending: () => PendingParquetFile | null;
}

/**
 * One-shot, in-memory handoff slot for passing a just-generated parquet
 * file to another Parquet Utility module without asking the user to
 * re-upload it. Deliberately NOT persisted (Blobs aren't JSON-serializable
 * and a stale handoff should never survive a real page reload).
 *
 * `consumePending` pops the value so it can only ever be applied once —
 * revisiting the destination module again, or refreshing the page, falls
 * back to the normal empty-upload experience.
 */
export const useParquetHandoffStore = create<ParquetHandoffState>()((set, get) => ({
  pending: null,
  setPending: (file) => set({ pending: file }),
  consumePending: () => {
    const current = get().pending;
    if (current) set({ pending: null });
    return current;
  },
}));
