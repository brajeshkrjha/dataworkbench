/**
 * Persisted set of favorited tool ids. Powers the "Favorites" section on
 * Home and the star toggle on tool cards.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteToolsState {
  toolIds: string[];
  isFavorite: (toolId: string) => boolean;
  toggleFavorite: (toolId: string) => void;
}

export const useFavoriteToolsStore = create<FavoriteToolsState>()(
  persist(
    (set, get) => ({
      toolIds: [],
      isFavorite: (toolId: string) => get().toolIds.includes(toolId),
      toggleFavorite: (toolId: string) => {
        const { toolIds } = get();
        set({
          toolIds: toolIds.includes(toolId)
            ? toolIds.filter((id) => id !== toolId)
            : [...toolIds, toolId],
        });
      },
    }),
    { name: "dataworkbench:favorite-tools" }
  )
);
