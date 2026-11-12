"use client";

import { useEffect } from "react";

/**
 * One global pointer listener feeds --mx/--my to the hovered `.spotlight`
 * element, so every card gets a cursor-following glow with zero per-card JS.
 */
export function PointerSpotlight() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".spotlight");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      target.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return <div aria-hidden className="scroll-progress" />;
}
