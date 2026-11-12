"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { FavoriteTools } from "@/features/tools/components/favorite-tools";
import { RecentTools } from "@/features/tools/components/recent-tools";
import { SystemStatusCard } from "@/features/tools/components/system-status-card";
import { ToolGridSkeleton } from "@/features/tools/components/tool-grid-skeleton";
import { WorkflowPanels } from "@/features/tools/components/workflow-panels";
import { useTools } from "@/features/tools/hooks/use-tools";

/** Home content: direct-to-module workflows, then personal shortcuts
 * (recents, favorites) alongside live platform status. */
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
      <WorkflowPanels />
      <div className="reveal grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentTools />
        <FavoriteTools />
        <SystemStatusCard />
      </div>
    </div>
  );
}
