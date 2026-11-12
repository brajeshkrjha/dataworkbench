"use client";

import { useMemo } from "react";
import { History } from "lucide-react";

import { ToolListCard } from "@/features/tools/components/tool-list-card";
import { useTools } from "@/features/tools/hooks/use-tools";
import { useRecentToolsStore } from "@/store/use-recent-tools-store";

/** Recently opened tools (real localStorage history), most recent first. */
export function RecentTools() {
  const { tools } = useTools();
  const recentIds = useRecentToolsStore((state) => state.toolIds);

  const recentTools = useMemo(() => {
    const byId = new Map(tools.map((tool) => [tool.id, tool]));
    return recentIds.map((id) => byId.get(id)).filter((tool) => tool !== undefined);
  }, [tools, recentIds]);

  return (
    <ToolListCard
      title="Recently opened"
      icon={History}
      tools={recentTools}
      emptyText="Tools you open will show up here so you can pick up where you left off."
    />
  );
}
