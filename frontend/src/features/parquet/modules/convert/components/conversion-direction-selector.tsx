"use client";

import { cn } from "@/lib/utils";

export type ConversionDirection = "to-parquet" | "from-parquet";

const DIRECTIONS: { value: ConversionDirection; label: string; description: string }[] = [
  { value: "to-parquet", label: "To Parquet", description: "Convert CSV, JSON, Excel, and more into Parquet." },
  { value: "from-parquet", label: "From Parquet", description: "Convert an existing Parquet file into another format." },
];

/**
 * Lets the user pick the conversion direction before choosing a format.
 * Future directions (if any) only require a registry entry here.
 */
export function ConversionDirectionSelector({
  selected,
  disabled,
  onSelect,
}: {
  selected: ConversionDirection;
  disabled?: boolean;
  onSelect: (direction: ConversionDirection) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {DIRECTIONS.map((direction) => {
        const isSelected = direction.value === selected;
        return (
          <button
            key={direction.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(direction.value)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isSelected ? "border-primary bg-accent" : "border-border hover:bg-accent"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected ? "border-primary" : "border-muted-foreground"
                )}
              >
                {isSelected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
              </span>
              {direction.label}
            </span>
            <span className="text-xs text-muted-foreground">{direction.description}</span>
          </button>
        );
      })}
    </div>
  );
}
