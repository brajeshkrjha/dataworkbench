"use client";

import { Boxes, Star, History, Wrench } from "lucide-react";

import { useTools } from "@/features/tools/hooks/use-tools";
import { getTotalModuleCount } from "@/features/tools/lib/module-count";
import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";
import { useRecentToolsStore } from "@/store/use-recent-tools-store";

/**
 * Real, at-a-glance workspace stats — no vanity metrics. Every number here
 * is either a count of registered data (tools/modules) or the user's own
 * activity (favorites/recents), and every card links somewhere useful.
 */
export function WorkspaceInsights() {
  const { tools } = useTools();
  const favoriteCount = useFavoriteToolsStore((state) => state.toolIds.length);
  const recentCount = useRecentToolsStore((state) => state.toolIds.length);

  if (tools.length === 0) return null;

  const moduleCount = getTotalModuleCount(tools.map((tool) => tool.id));

  const stats = [
    { label: "Total Tools", value: tools.length, icon: Wrench },
    { label: "Available Modules", value: moduleCount, icon: Boxes },
    { label: "Favorite Tools", value: favoriteCount, icon: Star },
    { label: "Recently Used", value: recentCount, icon: History },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
            <stat.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight tabular-nums">{stat.value}</p>
            <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
