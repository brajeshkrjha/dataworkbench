import { beforeEach, describe, expect, it } from "vitest";

import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";

describe("useFavoriteToolsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoriteToolsStore.setState({ toolIds: [] });
  });

  it("is not favorited by default", () => {
    expect(useFavoriteToolsStore.getState().isFavorite("parquet-utility")).toBe(false);
  });

  it("toggles a tool into and out of favorites", () => {
    const { toggleFavorite } = useFavoriteToolsStore.getState();
    toggleFavorite("parquet-utility");
    expect(useFavoriteToolsStore.getState().isFavorite("parquet-utility")).toBe(true);

    toggleFavorite("parquet-utility");
    expect(useFavoriteToolsStore.getState().isFavorite("parquet-utility")).toBe(false);
  });

  it("tracks multiple favorites independently", () => {
    const { toggleFavorite } = useFavoriteToolsStore.getState();
    toggleFavorite("a");
    toggleFavorite("b");
    expect(useFavoriteToolsStore.getState().toolIds.sort()).toEqual(["a", "b"]);
  });
});
