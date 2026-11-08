/**
 * Persisted theme preference. Light is the default for all users;
 * dark is opt-in via Settings. Persisted to localStorage so the choice
 * survives refreshes (applied synchronously via the inline script in
 * `app/layout.tsx` to avoid a flash of the wrong theme).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const THEME_STORAGE_KEY = "dataworkbench:theme";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
    }),
    { name: THEME_STORAGE_KEY }
  )
);
