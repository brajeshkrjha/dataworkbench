import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFilteredList } from "@/hooks/use-filtered-list";

describe("useFilteredList", () => {
  it("does not refilter when showing more rows or rerendering with the same inputs", () => {
    const items = Array.from({ length: 120 }, (_, i) => `table_${i}`);
    const match = vi.fn((item: string, query: string) => item.includes(query));
    const { result, rerender } = renderHook(() => useFilteredList(items, match, 50));
    act(() => result.current.setQuery("TABLE"));
    expect(match).toHaveBeenCalledTimes(120);
    const filtered = result.current.filtered;
    const visible = result.current.visible;
    rerender();
    expect(result.current.visible).toBe(visible);
    act(() => result.current.setVisibleCount(100));
    expect(result.current.visible).toHaveLength(100);
    expect(result.current.filtered).toBe(filtered);
    expect(match).toHaveBeenCalledTimes(120);
  });

  it("refilters when the input changes and preserves existing blank-query behavior", () => {
    const match = (item: string, query: string) => item.toLowerCase().includes(query);
    const { result, rerender } = renderHook(({ items }) => useFilteredList(items, match, 50), {
      initialProps: { items: ["Sales", "Customers"] },
    });
    act(() => result.current.setQuery("sales"));
    expect(result.current.filtered).toEqual(["Sales"]);
    rerender({ items: ["Sales", "Sales Archive", "Customers"] });
    expect(result.current.filtered).toEqual(["Sales", "Sales Archive"]);
    act(() => result.current.setQuery("   "));
    expect(result.current.visible).toEqual(["Sales", "Sales Archive", "Customers"]);
  });
});