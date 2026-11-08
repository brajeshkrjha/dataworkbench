"use client";

import { Download, Table2 } from "lucide-react";

import { formatBytes } from "@/features/parquet/shared/format-bytes";
import { DATA_TYPE_LABELS } from "@/features/parquet/modules/convert/constants";
import type { ConversionResult, MappedDataType } from "@/types/parquet";

export function ConversionResultPanel({
  result,
  downloadUrl,
  onDownload,
  onOpenInReader,
}: {
  result: ConversionResult;
  downloadUrl: string;
  onDownload?: () => void;
  onOpenInReader?: () => void;
}) {
  const ratio =
    result.sourceBytes > 0
      ? `${((result.outputBytes / result.sourceBytes) * 100).toFixed(0)}% of source`
      : "—";

  const schemaSummaryEntries = Object.entries(result.schemaSummary ?? {});

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            ✅ Conversion completed successfully
          </p>
          <p className="mt-2 truncate font-mono text-sm font-medium">{result.fileName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Converted from {result.sourceFormat.toUpperCase()} &middot;{" "}
            {result.compression} compression
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <a
            href={downloadUrl}
            download={result.fileName}
            onClick={onDownload}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Download Parquet
          </a>
          {onOpenInReader ? (
            <button
              type="button"
              onClick={onOpenInReader}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Table2 className="h-4 w-4" />
              Open in Parquet Reader
            </button>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-emerald-200/70 pt-4 dark:border-emerald-900/60 sm:grid-cols-4">
        <Stat label="Rows" value={result.rowCount.toLocaleString()} />
        <Stat label="Columns" value={String(result.columnCount)} />
        <Stat label="Output size" value={formatBytes(result.outputBytes)} />
        <Stat label="Size ratio" value={ratio} />
      </dl>

      {schemaSummaryEntries.length > 0 ? (
        <div className="mt-4 border-t border-emerald-200/70 pt-4 dark:border-emerald-900/60">
          <p className="text-xs font-medium text-muted-foreground">Schema summary</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {schemaSummaryEntries.map(([type, count]) => (
              <span
                key={type}
                className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs dark:border-emerald-900 dark:bg-emerald-950/40"
              >
                {count} {DATA_TYPE_LABELS[type as MappedDataType] ?? type}
                {count === 1 ? "" : "s"}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium">{value}</dd>
    </div>
  );
}
