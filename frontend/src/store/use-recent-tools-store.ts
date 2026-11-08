/**
 * Tracks recently opened tool ids, most-recent-first, capped at a small
 * number. Persisted to localStorage so "Recently opened" on Home reflects
 * real usage rather than being a placeholder.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENTS = 5;

interface RecentToolsState {
  toolIds: string[];
  recordVisit: (toolId: string) => void;
}

export const useRecentToolsStore = create<RecentToolsState>()(
  persist(
    (set, get) => ({
      toolIds: [],
      recordVisit: (toolId: string) => {
        const withoutCurrent = get().toolIds.filter((id) => id !== toolId);
        set({ toolIds: [toolId, ...withoutCurrent].slice(0, MAX_RECENTS) });
      },
    }),
    { name: "dataworkbench:recent-tools" }
  )
);
