"use client";

import { useMemo } from "react";

import { buildSearchIndex } from "@/features/search/search-index";
import { useTools } from "@/features/tools/hooks/use-tools";

/** Memoized global search index, rebuilt only when the tool registry changes. */
export function useSearchIndex() {
  const { tools, isLoading } = useTools();
  const index = useMemo(() => buildSearchIndex(tools), [tools]);
  return { index, isLoading };
}
