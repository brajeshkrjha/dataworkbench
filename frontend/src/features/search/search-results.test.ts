import { describe, expect, it } from "vitest";

import { searchItems } from "@/features/search/search-results";
import type { SearchResultItem } from "@/features/search/types";

const ITEMS: SearchResultItem[] = [
  {
    id: "tool:parquet-utility",
    kind: "tool",
    title: "Parquet Utility",
    description: "Convert, explore, and analyze Apache Parquet datasets.",
    href: "/tools/parquet-utility",
    icon: "Boxes",
    keywords: ["File Conversion"],
  },
  {
    id: "feature:parquet-utility:convert",
    kind: "feature",
    title: "Convert Files",
    description: "Convert between CSV, JSON, Excel, and more.",
    href: "/tools/parquet-utility/convert",
    icon: "ArrowLeftRight",
    keywords: ["Parquet Utility"],
    context: "Parquet Utility",
  },
  {
    id: "category:file_conversion",
    kind: "category",
    title: "File Conversion",
    description: "Browse File Conversion tools",
    href: "/tools?category=file_conversion",
    icon: "LayoutGrid",
    keywords: [],
  },
];

describe("searchItems", () => {
  it("returns nothing for an empty query", () => {
    expect(searchItems(ITEMS, "")).toEqual([]);
    expect(searchItems(ITEMS, "   ")).toEqual([]);
  });

  it("matches by title", () => {
    const results = searchItems(ITEMS, "parquet");
    expect(results.map((item) => item.id)).toContain("tool:parquet-utility");
  });

  it("matches feature titles independent of the parent tool", () => {
    const results = searchItems(ITEMS, "convert");
    expect(results[0].id).toBe("feature:parquet-utility:convert");
  });

  it("matches feature context (parent tool name)", () => {
    const results = searchItems(ITEMS, "parquet convert");
    expect(results.map((item) => item.id)).toContain("feature:parquet-utility:convert");
  });

  it("requires every query token to match", () => {
    expect(searchItems(ITEMS, "parquet nonexistentterm")).toEqual([]);
  });

  it("ranks exact/prefix title matches above description-only matches", () => {
    const results = searchItems(ITEMS, "file conversion");
    expect(results[0].id).toBe("category:file_conversion");
  });

  it("respects the limit parameter", () => {
    const results = searchItems(ITEMS, "e", 1);
    expect(results).toHaveLength(1);
  });
});
