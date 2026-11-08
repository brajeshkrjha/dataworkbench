"use client";

import { Download } from "lucide-react";

import type { LookerConversionResult } from "@/types/looker";

export function ConversionResultPanel({
  result,
  downloadUrl,
  onDownload,
}: {
  result: LookerConversionResult;
  downloadUrl: string;
  onDownload?: () => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            ✅ LookML package generated successfully
          </p>
          <p className="mt-2 truncate font-mono text-sm font-medium">{result.projectName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{result.outputFileName}</p>
        </div>
        <a
          href={downloadUrl}
          download={result.outputFileName}
          onClick={onDownload}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Download LookML Package
        </a>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-emerald-200/70 pt-4 dark:border-emerald-900/60 sm:grid-cols-4">
        <Stat label="Views generated" value={String(result.viewsGenerated)} />
        <Stat label="Explores generated" value={String(result.exploresGenerated)} />
        <Stat label="Relationships found" value={String(result.relationshipsFound)} />
        <Stat label="Measures found" value={String(result.measuresFound)} />
      </dl>
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
