import { CatalogCard } from "@/components/shared/catalog-card";
import { CATEGORY_LABELS } from "@/constants/tool-metadata";
import { getToolModuleCount } from "@/features/tools/lib/module-count";
import { isToolInteractive } from "@/lib/tool-status";
import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";
import type { ToolMetadata } from "@/types/tool";

export function ToolCard({ tool }: { tool: ToolMetadata }) {
  const isFavorite = useFavoriteToolsStore((state) => state.isFavorite(tool.id));
  const toggleFavorite = useFavoriteToolsStore((state) => state.toggleFavorite);
  const moduleCount = getToolModuleCount(tool.id);

  return (
    <CatalogCard
      toolId={tool.id}
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      href={tool.route}
      disabled={!isToolInteractive(tool.status)}
      isFavorite={isFavorite}
      onToggleFavorite={() => toggleFavorite(tool.id)}
      meta={
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="truncate font-semibold uppercase tracking-wide text-foreground/70">
            {CATEGORY_LABELS[tool.category]}
          </span>
          {moduleCount > 1 ? (
            <>
              <span aria-hidden className="text-border">
                &middot;
              </span>
              <span className="shrink-0">{moduleCount} modules</span>
            </>
          ) : null}
        </span>
      }
    />
  );
}
