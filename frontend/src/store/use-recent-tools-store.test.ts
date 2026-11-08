import { beforeEach, describe, expect, it } from "vitest";

import { useRecentToolsStore } from "@/store/use-recent-tools-store";

describe("useRecentToolsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentToolsStore.setState({ toolIds: [] });
  });

  it("records a visited tool", () => {
    useRecentToolsStore.getState().recordVisit("parquet-utility");
    expect(useRecentToolsStore.getState().toolIds).toEqual(["parquet-utility"]);
  });

  it("moves a re-visited tool to the front without duplicating it", () => {
    const { recordVisit } = useRecentToolsStore.getState();
    recordVisit("a");
    recordVisit("b");
    recordVisit("a");
    expect(useRecentToolsStore.getState().toolIds).toEqual(["a", "b"]);
  });

  it("caps the list at 5 most-recent entries", () => {
    const { recordVisit } = useRecentToolsStore.getState();
    ["a", "b", "c", "d", "e", "f"].forEach((id) => recordVisit(id));
    const { toolIds } = useRecentToolsStore.getState();
    expect(toolIds).toHaveLength(5);
    expect(toolIds[0]).toBe("f");
  });
});
