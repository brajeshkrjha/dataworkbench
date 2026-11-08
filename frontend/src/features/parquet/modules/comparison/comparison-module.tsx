"use client";

import { useState } from "react";
import { AlertCircle, Download, GitCompare, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDiffTable } from "@/features/parquet/modules/comparison/components/column-diff-table";
import { ComparisonSummaryCards } from "@/features/parquet/modules/comparison/components/comparison-summary-cards";
import { DriftPanel } from "@/features/parquet/modules/comparison/components/drift-panel";
import { FileMetadataRow } from "@/features/parquet/modules/comparison/components/file-metadata-row";
import { useSchemaComparison } from "@/features/parquet/modules/comparison/hooks/use-schema-comparison";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import { ReaderDropZone } from "@/features/parquet/modules/reader/components/reader-drop-zone";
import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";

export function ComparisonModule() {
  const {
    fileA,
    fileB,
    includeOrderChanges,
    isComparing,
    error,
    result,
    isExporting,
    hasResult,
    selectFileA,
    selectFileB,
    setIncludeOrderChanges,
    setError,
    compare,
    exportReport,
    reset,
  } = useSchemaComparison();

  const [errorTarget, setErrorTarget] = useState<"a" | "b" | null>(null);

  // Warn while files are selected/being compared or a result is on screen —
  // leaving the page loses the selected files and comparison state.
  useUnsavedWorkWarning(Boolean(fileA || fileB));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Quick Help: </span>
        Compare two parquet files to identify schema drift and compatibility risks before shipping
        a change downstream.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>File A (baseline)</CardTitle>
            <CardDescription>The original / previous version of the schema.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReaderDropZone
              file={fileA}
              disabled={isComparing}
              onSelect={selectFileA}
              onReject={(message) => {
                setErrorTarget("a");
                setError(message);
              }}
            />
            {fileA ? (
              <p className="mt-2 text-xs text-muted-foreground">{formatBytes(fileA.size)}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File B (new)</CardTitle>
            <CardDescription>The new / changed version to compare against File A.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReaderDropZone
              file={fileB}
              disabled={isComparing}
              onSelect={selectFileB}
              onReject={(message) => {
                setErrorTarget("b");
                setError(message);
              }}
            />
            {fileB ? (
              <p className="mt-2 text-xs text-muted-foreground">{formatBytes(fileB.size)}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => void compare()} disabled={!fileA || !fileB || isComparing || hasResult}>
          {isComparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
          {isComparing ? "Comparing..." : hasResult ? "Compared" : "Compare Schemas"}
        </Button>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeOrderChanges}
            disabled={isComparing || hasResult}
            onChange={(event) => setIncludeOrderChanges(event.target.checked)}
          />
          Include column order changes
        </label>

        {fileA || fileB || hasResult || error ? (
          <Button variant="ghost" onClick={reset} disabled={isComparing}>
            Reset
          </Button>
        ) : null}

        {hasResult ? (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={isExporting} onClick={() => void exportReport("markdown")}>
              <Download className="h-4 w-4" />
              Export Markdown
            </Button>
            <Button variant="outline" size="sm" disabled={isExporting} onClick={() => void exportReport("csv")}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {errorTarget === "a" ? "File A: " : errorTarget === "b" ? "File B: " : ""}Could not compare schemas
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-6">
          <FileMetadataRow fileA={result.file_a} fileB={result.file_b} />
          <ComparisonSummaryCards summary={result.summary} />
          <DriftPanel drift={result.drift} />
          <ColumnDiffTable columns={result.columns} />
        </div>
      ) : null}
    </div>
  );
}
