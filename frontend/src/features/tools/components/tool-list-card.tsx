"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { ToolIcon } from "@/components/shared/tool-icon";
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import type { ToolMetadata } from "@/types/tool";

/** Compact titled card listing tools as rows, with a helpful empty state
 * so the section is never a blank hole. Used for Recent and Favorites. */
export function ToolListCard({
  title,
  icon: Icon,
  tools,
  emptyText,
  footer,
}: {
  title: string;
  icon: LucideIcon;
  tools: ToolMetadata[];
  emptyText: string;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </header>

      {tools.length > 0 ? (
        <ul className="flex flex-col p-2">
          {tools.map((tool) => (
            <li key={tool.id}>
              <Link
                href={tool.route}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  <ToolIcon name={tool.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tool.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{CATEGORY_LABELS[tool.category]}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 px-4 py-6 text-sm text-muted-foreground">{emptyText}</p>
      )}

      {footer ? <div className="border-t border-border/70 px-4 py-2.5 text-xs">{footer}</div> : null}
    </section>
  );
}
