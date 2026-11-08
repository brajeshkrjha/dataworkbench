"use client";

import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CompareSourceDropZone } from "@/features/looker/modules/compare/components/compare-source-drop-zone";
import { buildCompareReportMarkdown, CompareResults } from "@/features/looker/modules/compare/components/compare-results";
import { useLookmlCompare } from "@/features/looker/modules/compare/use-lookml-compare";
import { downloadBlob } from "@/lib/download-blob";

function downloadReport(markdown: string, fileName: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  downloadBlob(blob, fileName);
}

export function CompareModule() {
  const { slotA, slotB, selectA, selectB, isLoading, error, setError, result, reset, run, bothReady } =
    useLookmlCompare();

  const canRun = bothReady && !isLoading && !result;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Package A</CardTitle>
            <CardDescription>The baseline / previous PBIP project or LookML package.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompareSourceDropZone slot={slotA} disabled={isLoading} onSelect={selectA} onReject={setError} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Package B</CardTitle>
            <CardDescription>The updated / current PBIP project or LookML package.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompareSourceDropZone slot={slotB} disabled={isLoading} onSelect={selectB} onReject={setError} />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void run()} disabled={!canRun}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isLoading ? "Comparing..." : result ? "Compared" : "Compare Packages"}
        </Button>
        {result ? (
          <Button
            variant="outline"
            onClick={() =>
              downloadReport(
                buildCompareReportMarkdown(result),
                `${result.project_name_a}_vs_${result.project_name_b}_comparison.md`
              )
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export report
          </Button>
        ) : null}
        {slotA || slotB || result || error ? (
          <Button variant="ghost" onClick={reset} disabled={isLoading}>
            Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Comparison failed</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {result ? (
        <CompareResults result={result} />
      ) : !isLoading ? (
        <EmptyState
          title="No comparison yet"
          description="Select two PBIP projects and/or LookML packages to see structural differences here."
        />
      ) : null}
    </div>
  );
}
