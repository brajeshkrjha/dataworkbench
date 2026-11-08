"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ToolIcon } from "@/components/shared/tool-icon";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/constants/tool-metadata";
import { useTools } from "@/features/tools/hooks/use-tools";

/** Discoverable category cards (icon + label + tool count), not tiny
 * floating badges — each links into `/tools` pre-filtered by category. */
export function CategoryQuickLinks() {
  const { tools } = useTools();

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of tools) {
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [tools]);

  if (categories.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Categories</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map(([category, count]) => (
          <Link
            key={category}
            href={`/tools?category=${category}`}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <ToolIcon name={CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </p>
              <p className="text-xs text-muted-foreground">
                {count} {count === 1 ? "tool" : "tools"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
