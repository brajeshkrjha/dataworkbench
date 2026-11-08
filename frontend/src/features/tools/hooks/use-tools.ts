"use client";

/**
 * Hook that ensures the tool registry is fetched exactly once and
 * exposes the cached list + loading/error state to components.
 */
import { useEffect } from "react";

import { useToolStore } from "@/store/use-tool-store";

export function useTools() {
  const tools = useToolStore((state) => state.tools);
  const isLoading = useToolStore((state) => state.isLoading);
  const error = useToolStore((state) => state.error);
  const hasFetched = useToolStore((state) => state.hasFetched);
  const fetchTools = useToolStore((state) => state.fetchTools);

  useEffect(() => {
    if (!hasFetched) {
      void fetchTools();
    }
  }, [hasFetched, fetchTools]);

  return { tools, isLoading, error };
}
