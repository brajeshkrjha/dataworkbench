"use client";

import { Badge } from "@/components/ui/badge";
import {
  CSV_DELIMITER_OPTIONS,
  CSV_QUOTING_OPTIONS,
  DEFAULT_CSV_DELIMITER,
  DEFAULT_CSV_QUOTING,
} from "@/features/parquet/modules/convert/constants";
import { cn } from "@/lib/utils";
import type { CsvDelimiter, CsvQuoting } from "@/types/parquet";

export function CsvExportOptions({
  delimiter,
  includeHeader,
  quoting,
  outputFileName,
  defaultOutputName,
  disabled,
  onDelimiterChange,
  onIncludeHeaderChange,
  onQuotingChange,
  onOutputFileNameChange,
}: {
  delimiter: CsvDelimiter;
  includeHeader: boolean;
  quoting: CsvQuoting;
  outputFileName: string;
  defaultOutputName: string;
  disabled?: boolean;
  onDelimiterChange: (delimiter: CsvDelimiter) => void;
  onIncludeHeaderChange: (includeHeader: boolean) => void;
  onQuotingChange: (quoting: CsvQuoting) => void;
  onOutputFileNameChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium">Delimiter</label>
          {delimiter === DEFAULT_CSV_DELIMITER ? <Badge variant="secondary">Default</Badge> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CSV_DELIMITER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onDelimiterChange(option.value)}
              title={option.hint}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                delimiter === option.value ? "border-primary bg-accent" : "border-border hover:bg-accent"
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium">Header row</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onIncludeHeaderChange(true)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
              includeHeader ? "border-primary bg-accent" : "border-border hover:bg-accent"
            )}
          >
            <span className="block text-sm font-medium">Include header</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Column names as the first row</span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onIncludeHeaderChange(false)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
              !includeHeader ? "border-primary bg-accent" : "border-border hover:bg-accent"
            )}
          >
            <span className="block text-sm font-medium">Exclude header</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Data rows only</span>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-sm font-medium">Quoting</label>
          {quoting === DEFAULT_CSV_QUOTING ? <Badge variant="secondary">Default</Badge> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CSV_QUOTING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onQuotingChange(option.value)}
              title={option.hint}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                quoting === option.value ? "border-primary bg-accent" : "border-border hover:bg-accent"
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="csv-output-name" className="mb-2 block text-sm font-medium">
          Output file name <span className="text-muted-foreground">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="csv-output-name"
            type="text"
            value={outputFileName}
            disabled={disabled}
            placeholder={defaultOutputName}
            onChange={(event) => onOutputFileNameChange(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <span className="font-mono text-sm text-muted-foreground">.csv</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Defaults to the source file name with a timestamp appended.
        </p>
      </div>
    </div>
  );
}
