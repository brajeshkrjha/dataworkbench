"use client";

import { useEffect } from "react";

import { useRecentToolsStore } from "@/store/use-recent-tools-store";

/** Records a visit to `toolId` on mount so it surfaces in "Recently opened" on Home. */
export function useTrackRecentTool(toolId: string) {
  const recordVisit = useRecentToolsStore((state) => state.recordVisit);

  useEffect(() => {
    recordVisit(toolId);
  }, [toolId, recordVisit]);
}
