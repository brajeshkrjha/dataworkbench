"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Star } from "lucide-react";

import { ToolListCard } from "@/features/tools/components/tool-list-card";
import { useTools } from "@/features/tools/hooks/use-tools";
import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";

/** Favorited tools on Home, with a hint on how to add one when empty. */
export function FavoriteTools() {
  const { tools } = useTools();
  const favoriteIds = useFavoriteToolsStore((state) => state.toolIds);

  const favoriteTools = useMemo(
    () => tools.filter((tool) => favoriteIds.includes(tool.id)),
    [tools, favoriteIds]
  );

  return (
    <ToolListCard
      title="Favorites"
      icon={Star}
      tools={favoriteTools}
      emptyText="Star a tool on the Tools page to pin it here for one-click access."
      footer={
        <Link href="/tools" className="font-medium text-primary hover:underline">
          Browse all tools
        </Link>
      }
    />
  );
}
