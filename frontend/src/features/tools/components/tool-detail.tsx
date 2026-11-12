"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ToolLogo } from "@/components/shared/tool-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { toolService } from "@/services/tool-service";
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import { useTrackRecentTool } from "@/features/tools/hooks/use-track-recent-tool";
import type { ToolMetadata } from "@/types/tool";

/**
 * Generic tool detail framework. Individual tools will later render
 * their own interactive UI; for now this renders registry metadata and
 * a "coming soon" placeholder, driven entirely by the Tool Registry.
 */
export function ToolDetail({ toolId }: { toolId: string }) {
  useTrackRecentTool(toolId);
  const [tool, setTool] = useState<ToolMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    toolService
      .getTool(toolId)
      .then((data) => {
        if (!cancelled) setTool(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tool.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toolId]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (error || !tool) {
    return (
      <EmptyState
        title="Tool not found"
        description={error ?? `No tool registered with id "${toolId}".`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-6">
        <ToolLogo toolId={tool.id} icon={tool.icon} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{tool.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{CATEGORY_LABELS[tool.category]}</span>
            <span>&middot;</span>
            <span>v{tool.version}</span>
          </div>
        </div>
      </div>

      <EmptyState
        title="This tool is under construction"
        description="The interactive experience for this tool will be implemented in a future phase."
      />
    </div>
  );
}

