"use client";

import { Badge } from "@/components/ui/badge";
import { ToolIcon } from "@/components/shared/tool-icon";
import { SOURCE_FORMATS, type SourceFormatDefinition } from "@/features/parquet/shared/format-registry";
import { cn } from "@/lib/utils";

/**
 * Lets the user pick an input format before uploading. Renders every
 * registered source format so future formats (Excel, TSV, Avro, ...)
 * only require a registry entry, not a UI change.
 */
export function SourceFormatSelector({
  selected,
  disabled,
  onSelect,
}: {
  selected: SourceFormatDefinition;
  disabled?: boolean;
  onSelect: (format: SourceFormatDefinition) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SOURCE_FORMATS.map((format) => {
        const isAvailable = format.status === "available";
        const isSelected = format.id === selected.id;
        return (
          <button
            key={format.id}
            type="button"
            disabled={disabled || !isAvailable}
            onClick={() => onSelect(format)}
            title={format.description}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isSelected ? "border-primary bg-accent" : "border-border hover:bg-accent"
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ToolIcon name={format.icon} className="h-3.5 w-3.5" />
                {format.label}
              </span>
              {!isAvailable ? <Badge variant="secondary">Planned</Badge> : null}
            </span>
            <span className="text-xs text-muted-foreground">{format.description}</span>
          </button>
        );
      })}
    </div>
  );
}
