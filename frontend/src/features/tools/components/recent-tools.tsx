"use client";

import { useMemo } from "react";

import { ToolGrid } from "@/features/tools/components/tool-grid";
import { useTools } from "@/features/tools/hooks/use-tools";
import { useRecentToolsStore } from "@/store/use-recent-tools-store";

/**
 * "Recent Activity" — currently backed by real recently-opened-tool
 * history. Structured as its own section (rather than folded into the
 * main tool grid) so future activity kinds — recent conversions, recent
 * analyses — can be added as additional subsections here without
 * reshaping the page. Renders nothing until there is real usage data;
 * no placeholder/fake activity is ever shown.
 */
export function RecentTools() {
  const { tools } = useTools();
  const recentIds = useRecentToolsStore((state) => state.toolIds);

  const recentTools = useMemo(() => {
    const byId = new Map(tools.map((tool) => [tool.id, tool]));
    return recentIds.map((id) => byId.get(id)).filter((tool) => tool !== undefined);
  }, [tools, recentIds]);

  if (recentTools.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Recently Opened Tools</h2>
      <ToolGrid tools={recentTools} />
    </section>
  );
}
