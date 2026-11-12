"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

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

  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const present = new Set(tools.map((tool) => tool.category));
    return Array.from(present);
  }, [tools]);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (activeCategory !== "all" && tool.category !== activeCategory) return false;
      if (!q) return true;
      return [tool.name, tool.description, ...(tool.tags ?? [])].join(" ").toLowerCase().includes(q);
    });
  }, [tools, activeCategory, query]);

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
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools..."
          aria-label="Search tools"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
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
      {filteredTools.length > 0 ? (
        <ToolGrid tools={filteredTools} />
      ) : (
        <EmptyState title="No tools found" description="Try a different search or category." />
      )}
    </div>
  );
}

