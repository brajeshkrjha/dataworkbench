"use client";

import { Badge } from "@/components/ui/badge";
import {
  COMPRESSION_OPTIONS,
  DEFAULT_COMPRESSION,
} from "@/features/parquet/modules/convert/constants";
import { cn } from "@/lib/utils";
import type { CompressionCodec } from "@/types/parquet";

export function ConversionOptions({
  compression,
  outputFileName,
  defaultOutputName,
  disabled,
  onCompressionChange,
  onOutputFileNameChange,
}: {
  compression: CompressionCodec;
  outputFileName: string;
  defaultOutputName: string;
  disabled?: boolean;
  onCompressionChange: (compression: CompressionCodec) => void;
  onOutputFileNameChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium">Compression</label>
          {compression === DEFAULT_COMPRESSION ? (
            <Badge variant="secondary">Default</Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COMPRESSION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onCompressionChange(option.value)}
              title={option.hint}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                compression === option.value
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-accent"
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="parquet-output-name"
          className="mb-2 block text-sm font-medium"
        >
          Output file name <span className="text-muted-foreground">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="parquet-output-name"
            type="text"
            value={outputFileName}
            disabled={disabled}
            placeholder={defaultOutputName}
            onChange={(event) => onOutputFileNameChange(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <span className="font-mono text-sm text-muted-foreground">.parquet</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Defaults to the source file name.
        </p>
      </div>
    </div>
  );
}
