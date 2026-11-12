import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolIcon } from "@/components/shared/tool-icon";
import { ToolLogo, TOOL_LOGOS } from "@/components/shared/tool-logo";
import { cn } from "@/lib/utils";

/**
 * Shared presentational card for anything that belongs in a catalog grid:
 * tools (Tool Catalog) and tool modules/features (e.g. Parquet Utility's
 * feature catalog). Keeping one implementation means every catalog in the
 * app looks and behaves identically as more tools/modules are added.
 */
export function CatalogCard({
  toolId,
  icon,
  title,
  description,
  badge,
  meta,
  href,
  disabled,
  className,
  isFavorite,
  onToggleFavorite,
}: {
  toolId?: string;
  icon: string;
  title: string;
  description: string;
  badge?: ReactNode;
  meta?: ReactNode;
  href: string;
  disabled?: boolean;
  className?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const content = (
    <Card
      className={cn(
        "group h-full border-border/80 transition-all",
        !disabled && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          {toolId && TOOL_LOGOS[toolId] ? (
            <ToolLogo toolId={toolId} icon={icon} size="md" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
              <ToolIcon name={icon} className="h-5 w-5" />
            </div>
          )}
          <div className="flex items-center gap-1">
            {badge}
            {onToggleFavorite ? (
              <button
                type="button"
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFavorite();
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-400")} />
              </button>
            ) : null}
          </div>
        </div>
        <CardTitle className="mt-3 text-base">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      {meta ? (
        <CardContent className="flex items-center justify-between gap-2 pt-0">
          <div className="min-w-0">{meta}</div>
          {!disabled ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground/70 transition-colors group-hover:text-primary">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );

  if (disabled) {
    return <div className={cn("cursor-not-allowed opacity-70", className)}>{content}</div>;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

