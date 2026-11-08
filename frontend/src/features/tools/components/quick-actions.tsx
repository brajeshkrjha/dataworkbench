"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/shared/tool-icon";
import { useTools } from "@/features/tools/hooks/use-tools";
import { getToolModuleCount } from "@/features/tools/lib/module-count";
import { isToolInteractive } from "@/lib/tool-status";

/**
 * Large, one-click cards for the platform's primary workspaces (tools that
 * host multiple modules, e.g. Parquet Utility / GCP Looker Utility) — the
 * tools people open every day.
 */
export function QuickActions() {
  const { tools } = useTools();

  const primaryTools = tools.filter(
    (tool) => getToolModuleCount(tool.id) > 1 && isToolInteractive(tool.status)
  );

  if (primaryTools.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Quick Access</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {primaryTools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.route}
            className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="bg-gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm">
                <ToolIcon name={tool.icon} className="h-5 w-5" />
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {getToolModuleCount(tool.id)} modules
              </span>
            </div>
            <div>
              <p className="font-semibold tracking-tight">{tool.name}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto w-fit group-hover:border-primary/40"
              tabIndex={-1}
            >
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        ))}
      </div>
    </section>
  );
}
