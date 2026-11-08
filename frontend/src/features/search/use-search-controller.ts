"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { searchItems } from "@/features/search/search-results";
import { useSearchIndex } from "@/features/search/use-search-index";
import type { SearchResultItem } from "@/features/search/types";

/**
 * Shared query/selection/keyboard-navigation state for any search
 * surface (navbar command palette, home page search bar, ...). Keeping
 * this logic in one hook is what lets multiple search UIs stay in sync
 * with zero duplicated behavior.
 */
export function useSearchController(onNavigate?: () => void) {
  const { index } = useSearchIndex();
  const router = useRouter();
  const [query, setQueryState] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchItems(index, query), [index, query]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (item: SearchResultItem) => {
      router.push(item.href);
      setQueryState("");
      setActiveIndex(0);
      onNavigate?.();
    },
    [router, onNavigate]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        select(results[activeIndex]);
      }
    },
    [results, activeIndex, select]
  );

  return { query, setQuery, results, activeIndex, setActiveIndex, select, handleKeyDown };
}
