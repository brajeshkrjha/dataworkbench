"use client";

import { useMemo } from "react";

import { ToolGrid } from "@/features/tools/components/tool-grid";
import { useTools } from "@/features/tools/hooks/use-tools";
import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";

/** Shows favorited tools on Home. Renders nothing until the user favorites one. */
export function FavoriteTools() {
  const { tools } = useTools();
  const favoriteIds = useFavoriteToolsStore((state) => state.toolIds);

  const favoriteTools = useMemo(
    () => tools.filter((tool) => favoriteIds.includes(tool.id)),
    [tools, favoriteIds]
  );

  if (favoriteTools.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Favorites</h2>
      <ToolGrid tools={favoriteTools} />
    </section>
  );
}
