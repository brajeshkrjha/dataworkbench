"use client";

import { useTrackRecentTool } from "@/features/tools/hooks/use-track-recent-tool";

/**
 * Records a tool visit for tools that use their own static route (e.g.
 * Parquet Utility) instead of the generic `[toolId]` catch-all, which
 * tracks visits itself.
 */
export function TrackRecentTool({ toolId }: { toolId: string }) {
  useTrackRecentTool(toolId);
  return null;
}
