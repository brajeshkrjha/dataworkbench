"use client";

import { useMemo, useState } from "react";

/** Keep filtering independent from pagination. Pass a stable match function. */
export function useFilteredList<T>(
  items: T[],
  match: (item: T, query: string) => boolean,
  pageSize: number
) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const lower = query.toLowerCase();
    return items.filter((item) => match(item, lower));
  }, [items, query, match]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  return { query, setQuery, filtered, visible, setVisibleCount };
}