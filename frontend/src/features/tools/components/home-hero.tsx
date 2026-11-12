"use client";

import { AnimatedNumber } from "@/components/motion/motion-primitives";
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
    <section className="glow-border shadow-elevated relative rounded-2xl border border-border/70 bg-card px-6 py-8 sm:px-10 sm:py-12">
      <div aria-hidden className="bg-gradient-hero pointer-events-none absolute inset-0 rounded-2xl" />
      <div aria-hidden className="aurora" />
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
          <dl className="grid w-full max-w-sm grid-cols-3 divide-x divide-border/70 rounded-xl border border-border/70 bg-card/60 py-2.5 text-center backdrop-blur-sm">
            {[
              { label: "Tools", value: tools.length },
              { label: "Modules", value: moduleCount },
              { label: "Categories", value: categoryCount },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse items-center gap-0.5 px-2">
                <dt className="text-[11px] font-medium text-muted-foreground">{stat.label}</dt>
                <dd className="text-lg font-semibold leading-none tabular-nums text-foreground"><AnimatedNumber value={stat.value} /></dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}



