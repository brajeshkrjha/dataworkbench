"use client";

import { useEffect } from "react";

import { useThemeStore } from "@/store/use-theme-store";

/**
 * Keeps the `.dark` class on <html> in sync with the persisted theme
 * preference whenever it changes at runtime (e.g. from Settings). The
 * initial class on first paint is set synchronously by the inline
 * script in `app/layout.tsx`, not by this effect, to avoid a flash of
 * the wrong theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
