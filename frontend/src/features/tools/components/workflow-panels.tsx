"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StaggerGroup, StaggerItem } from "@/components/motion/motion-primitives";
import { ToolIcon } from "@/components/shared/tool-icon";
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import { useTools } from "@/features/tools/hooks/use-tools";
import { getToolModules } from "@/features/tools/lib/tool-modules";
import { isToolInteractive } from "@/lib/tool-status";

/** Number of featured workflows on Home; the rest live on the Tools page. */
const FEATURED_TOOLS = 3;
/** Overlapping icons shown in the "explore more" banner. */
const PREVIEW_ICONS = 4;

/**
 * Featured workflow panels (first few tools) with direct module deep links,
 * plus a link to the full Tools page so Home stays compact at any scale.
 */
export function WorkflowPanels() {
  const { tools } = useTools();
  const available = tools.filter((tool) => isToolInteractive(tool.status));

  if (available.length === 0) return null;

  const featured = available.slice(0, FEATURED_TOOLS);
  const remaining = available.length - featured.length;
  const preview = available.slice(FEATURED_TOOLS, FEATURED_TOOLS + PREVIEW_ICONS);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Workflows</h2>

      <StaggerGroup className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        {featured.map((tool) => {
          const modules = getToolModules(tool.id);
          return (
            <StaggerItem key={tool.id} className="spotlight flex flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-elevated">
              <Link
                href={tool.route}
                className="group flex items-start gap-3 border-b border-border/70 p-4 transition-colors hover:bg-accent/40"
              >
                <span className="bg-gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
                  <ToolIcon name={tool.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tracking-tight">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[tool.category]}
                    {modules.length > 1 ? ` Â· ${modules.length} modules` : ""}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>

              {modules.length > 0 ? (
                <ul className="flex flex-col p-2">
                  {modules.map((module) => (
                    <li key={module.id}>
                      <Link
                        href={module.href}
                        className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50"
                      >
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                          <ToolIcon name={module.icon} className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{module.label}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{module.description}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                  <Link
                    href={tool.route}
                    className="mt-auto inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Open tool
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      {remaining > 0 ? (
        <Link
          href="/tools"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm transition-colors hover:bg-accent/40"
        >
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {preview.map((tool) => (
                <span
                  key={tool.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-primary ring-2 ring-card"
                >
                  <ToolIcon name={tool.icon} className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
            <p className="text-sm font-medium">
              Explore {remaining} more {remaining === 1 ? "tool" : "tools"}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      ) : null}
    </section>
  );
}

