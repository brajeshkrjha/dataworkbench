"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { ToolGrid } from "@/features/tools/components/tool-grid";
import { ToolGridSkeleton } from "@/features/tools/components/tool-grid-skeleton";
import { useTools } from "@/features/tools/hooks/use-tools";
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import { cn } from "@/lib/utils";
import type { ToolCategory } from "@/types/tool";

function isToolCategory(value: string | null): value is ToolCategory {
  return value !== null && value in CATEGORY_LABELS;
}

export function ToolCatalog() {
  const { tools, isLoading, error } = useTools();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">(
    isToolCategory(initialCategory) ? initialCategory : "all"
  );

  const categories = useMemo(() => {
    const present = new Set(tools.map((tool) => tool.category));
    return Array.from(present);
  }, [tools]);

  const filteredTools = useMemo(() => {
    if (activeCategory === "all") return tools;
    return tools.filter((tool) => tool.category === activeCategory);
  }, [tools, activeCategory]);

  if (isLoading) {
    return <ToolGridSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load tools"
        description={error}
      />
    );
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            activeCategory === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-accent"
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeCategory === category
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>
      <ToolGrid tools={filteredTools} />
    </div>
  );
}
