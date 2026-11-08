"use client";

import { useEffect } from "react";

/** Warn before closing/reloading a tab while a tool has unfinished work. */
export function useUnsavedWorkWarning(hasUnsavedWork: boolean): void {
  useEffect(() => {
    if (!hasUnsavedWork) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome requires returnValue to be set to trigger the native prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedWork]);
}