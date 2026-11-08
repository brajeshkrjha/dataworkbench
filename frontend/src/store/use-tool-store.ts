/**
 * Zustand store caching the Tool Registry fetched from the backend.
 * Only introduced here because tool metadata is needed across many
 * independent routes/components (sidebar, dashboard, catalog, detail).
 */
import { create } from "zustand";

import { toolService } from "@/services/tool-service";
import type { ToolMetadata } from "@/types/tool";

interface ToolStoreState {
  tools: ToolMetadata[];
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetchTools: () => Promise<void>;
}

let inFlightFetch: Promise<void> | null = null;

export const useToolStore = create<ToolStoreState>((set, get) => ({
  tools: [],
  isLoading: true,
  error: null,
  hasFetched: false,

  fetchTools: async () => {
    if (get().hasFetched) return;
    if (inFlightFetch) return inFlightFetch;

    set({ isLoading: true, error: null });
    inFlightFetch = (async () => {
      try {
        const response = await toolService.listTools();
        set({ tools: response.tools, isLoading: false, hasFetched: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load tools.";
        set({ isLoading: false, error: message, hasFetched: true });
      } finally {
        inFlightFetch = null;
      }
    })();
    return inFlightFetch;
  },
}));
