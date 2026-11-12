"use client";

import { AlertCircle, ArrowLeftRight, Download, GitCompare, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DiffView } from "@/features/text-compare/components/diff-view";
import { SourceInput } from "@/features/text-compare/components/source-input";
import { SummaryPanel } from "@/features/text-compare/components/summary-panel";
import { useTextCompare } from "@/features/text-compare/hooks/use-text-compare";
import { useUnsavedWorkWarning } from "@/hooks/use-unsaved-work-warning";

export function TextCompareModule() {
  const {
    fileA,
    textA,
    fileB,
    textB,
    isComparing,
    isExporting,
    error,
    result,
    hasInputA,
    hasInputB,
    ignoreCase,
    ignoreWhitespace,
    version,
    setFileA,
    setTextA,
    setFileB,
    setTextB,
    setIgnoreCase,
    setIgnoreWhitespace,
    swap,
    reset,
    compare,
    exportReport,
  } = useTextCompare();

  useUnsavedWorkWarning(hasInputA || hasInputB);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <SourceInput key={`a-${version}`} label="Version A" file={fileA} text={textA} disabled={isComparing} onSelectFile={setFileA} onChangeText={setTextA} />
        <div className="flex justify-center lg:pt-9">
          <Button
            variant="outline"
            size="icon"
            aria-label="Swap Version A and Version B"
            title="Swap A and B"
            disabled={isComparing || (!hasInputA && !hasInputB)}
            onClick={swap}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>
        <SourceInput key={`b-${version}`} label="Version B" file={fileB} text={textB} disabled={isComparing} onSelectFile={setFileB} onChangeText={setTextB} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-2">
            <Button disabled={!hasInputA || !hasInputB || isComparing || result !== null} onClick={compare}>
              {isComparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompare className="mr-2 h-4 w-4" />}
              Compare
            </Button>
            <Button variant="ghost" onClick={reset} disabled={isComparing}>
              Reset
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={ignoreCase} disabled={isComparing} onChange={(e) => setIgnoreCase(e.target.checked)} />
              Ignore case
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={ignoreWhitespace} disabled={isComparing} onChange={(e) => setIgnoreWhitespace(e.target.checked)} />
              Ignore whitespace
            </label>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {result.file_name_a} vs {result.file_name_b}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={isExporting} onClick={() => exportReport("markdown")}>
                <Download className="mr-2 h-4 w-4" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" disabled={isExporting} onClick={() => exportReport("csv")}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          <SummaryPanel summary={result.summary} />

          <DiffView lines={result.text_detail.lines} labelA={result.file_name_a} labelB={result.file_name_b} />
        </div>
      ) : null}
    </div>
  );
}
