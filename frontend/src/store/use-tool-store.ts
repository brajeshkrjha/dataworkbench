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

// Last successful registry, shown instantly on repeat visits while the (possibly cold-start)
// backend revalidates it in the background.
const CACHE_KEY = "dwb:tools-cache";

function readCachedTools(): ToolMetadata[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as ToolMetadata[]) : null;
  } catch {
    return null;
  }
}

function writeCachedTools(tools: ToolMetadata[]): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(tools));
  } catch {
    // Storage unavailable or full; caching is best-effort.
  }
}

export const useToolStore = create<ToolStoreState>((set, get) => ({
  tools: [],
  isLoading: true,
  error: null,
  hasFetched: false,

  fetchTools: async () => {
    if (get().hasFetched) return;
    if (inFlightFetch) return inFlightFetch;

    const cached = readCachedTools();
    set(cached ? { tools: cached, isLoading: false, error: null } : { isLoading: true, error: null });
    inFlightFetch = (async () => {
      try {
        const response = await toolService.listTools();
        writeCachedTools(response.tools);
        set({ tools: response.tools, isLoading: false, hasFetched: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load tools.";
        // Keep showing cached tools if the revalidation fails.
        set({ isLoading: false, error: get().tools.length > 0 ? null : message, hasFetched: true });
      } finally {
        inFlightFetch = null;
      }
    })();
    return inFlightFetch;
  },
}));
