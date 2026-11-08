"use client";

import { SearchBar } from "@/features/search/components/search-bar";
import { siteConfig } from "@/config/site";
import { useTools } from "@/features/tools/hooks/use-tools";
import { getTotalModuleCount } from "@/features/tools/lib/module-count";

/**
 * Premium hero workspace panel: title, value statement, and the global
 * search box integrated into one bordered surface (not floating on empty
 * page whitespace), plus a live at-a-glance stat strip underneath.
 */
export function HomeHero() {
  const { tools } = useTools();
  const categoryCount = new Set(tools.map((tool) => tool.category)).size;
  const moduleCount = getTotalModuleCount(tools.map((tool) => tool.id));

  return (
    <section className="relative rounded-2xl border border-border/70 bg-card px-6 py-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-10px_rgba(49,46,129,0.22)] sm:px-10 sm:py-12">
      <div aria-hidden className="bg-gradient-hero pointer-events-none absolute inset-0 rounded-2xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-border to-transparent"
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-gradient-brand text-3xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">
            {siteConfig.name}
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Build, convert, analyze, and explore data more efficiently.
          </p>
        </div>
        <SearchBar />
        {tools.length > 0 ? (
          <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <dt>Tools</dt>
              <dd className="text-foreground">{tools.length}</dd>
            </div>
            <span aria-hidden className="text-border">
              |
            </span>
            <div className="flex items-center gap-1.5">
              <dt>Modules</dt>
              <dd className="text-foreground">{moduleCount}</dd>
            </div>
            <span aria-hidden className="text-border">
              |
            </span>
            <div className="flex items-center gap-1.5">
              <dt>Categories</dt>
              <dd className="text-foreground">{categoryCount}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
