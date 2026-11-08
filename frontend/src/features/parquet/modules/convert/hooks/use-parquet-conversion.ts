"use client";

import { useParquetConversionStore } from "@/store/use-parquet-conversion-store";

/**
 * Thin selector wrapper around the module-level conversion store (see
 * `store/use-parquet-conversion-store.ts` for why this moved out of
 * component-local `useState`). Kept as a hook — with the exact same
 * returned shape as before — so `ConvertModule` and existing tests don't
 * need to change how they consume it.
 */
export function useParquetConversion() {
  const state = useParquetConversionStore();

  // Unfinished work = a file is selected but hasn't yet been converted and
  // downloaded. Cleared once the resulting parquet file is downloaded, or
  // when there's no file at all.
  const hasUnsavedWork = Boolean(state.file) && !state.hasDownloaded;

  return { ...state, hasUnsavedWork };
}
