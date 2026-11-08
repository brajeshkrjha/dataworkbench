import { describe, expect, it } from "vitest";

import { buildSearchIndex } from "@/features/search/search-index";
import type { ToolMetadata } from "@/types/tool";

const PARQUET_TOOL: ToolMetadata = {
  id: "parquet-utility",
  name: "Parquet Utility",
  description: "Convert, explore, and analyze Apache Parquet datasets.",
  category: "file_conversion",
  icon: "Boxes",
  route: "/tools/parquet-utility",
  version: "0.1.0",
  status: "available",
};

describe("buildSearchIndex", () => {
  it("includes a tool entry for every tool", () => {
    const index = buildSearchIndex([PARQUET_TOOL]);
    expect(index.find((item) => item.id === "tool:parquet-utility")).toBeTruthy();
  });

  it("includes one category entry per distinct category", () => {
    const index = buildSearchIndex([PARQUET_TOOL, { ...PARQUET_TOOL, id: "other-tool" }]);
    const categoryEntries = index.filter((item) => item.kind === "category");
    expect(categoryEntries).toHaveLength(1);
    expect(categoryEntries[0].id).toBe("category:file_conversion");
  });

  it("includes registered feature entries for a tool with a feature provider", () => {
    const index = buildSearchIndex([PARQUET_TOOL]);
    const featureEntries = index.filter((item) => item.kind === "feature");
    expect(featureEntries.length).toBeGreaterThan(0);
    expect(featureEntries.every((item) => item.context === "Parquet Utility")).toBe(true);
  });

  it("returns no feature entries for a tool without a registered provider", () => {
    const index = buildSearchIndex([{ ...PARQUET_TOOL, id: "unregistered-tool" }]);
    expect(index.filter((item) => item.kind === "feature")).toEqual([]);
  });
});
