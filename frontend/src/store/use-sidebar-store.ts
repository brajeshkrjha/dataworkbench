/**
 * Persisted sidebar collapse state, shared across the app so the
 * preference survives refreshes and navigation.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isCollapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
    }),
    { name: "dataworkbench:sidebar" }
  )
);
