"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { FavoriteTools } from "@/features/tools/components/favorite-tools";
import { QuickActions } from "@/features/tools/components/quick-actions";
import { RecentTools } from "@/features/tools/components/recent-tools";
import { ToolGridSkeleton } from "@/features/tools/components/tool-grid-skeleton";
import { WorkspaceInsights } from "@/features/tools/components/workspace-insights";
import { useTools } from "@/features/tools/hooks/use-tools";

/** Discovery-focused Home content: insights, quick access,
 * recents/favorites. Full catalog browsing lives on the Tools tab. */
export function HomeOverview() {
  const { tools, isLoading, error } = useTools();

  if (isLoading) {
    return <ToolGridSkeleton />;
  }

  if (error) {
    return <EmptyState title="Unable to load tools" description={error} />;
  }

  if (tools.length === 0) {
    return (
      <EmptyState
        title="No tools registered yet"
        description="Tools will appear here as they are added to the registry."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <WorkspaceInsights />
      <QuickActions />
      <FavoriteTools />
      <RecentTools />
    </div>
  );
}

