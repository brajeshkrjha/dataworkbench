import { beforeEach, describe, expect, it } from "vitest";

import { useSidebarStore } from "@/store/use-sidebar-store";

describe("useSidebarStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useSidebarStore.setState({ isCollapsed: false });
  });

  it("defaults to expanded", () => {
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });

  it("toggles to collapsed and back", () => {
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isCollapsed).toBe(true);

    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().isCollapsed).toBe(false);
  });
});
