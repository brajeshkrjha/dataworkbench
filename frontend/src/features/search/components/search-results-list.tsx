"use client";

import { ToolIcon } from "@/components/shared/tool-icon";
import { cn } from "@/lib/utils";
import type { SearchResultItem, SearchResultKind } from "@/features/search/types";

const KIND_LABELS: Record<SearchResultKind, string> = {
  tool: "Tools",
  feature: "Features",
  category: "Categories",
};

const KIND_ORDER: SearchResultKind[] = ["tool", "feature", "category"];

export function SearchResultsList({
  results,
  activeIndex,
  onHover,
  onSelect,
}: {
  results: SearchResultItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: SearchResultItem) => void;
}) {
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: results.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="max-h-96 overflow-y-auto py-2">
      {groups.map((group) => (
        <div key={group.kind} className="mb-1 last:mb-0">
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[group.kind]}
          </p>
          {group.items.map((item) => {
            const index = results.indexOf(item);
            const isActive = index === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <ToolIcon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.context ? `${item.context} · ` : ""}
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
