"use client";

import { AlertCircle, Download, GitCompare, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DiffView } from "@/features/text-compare/components/diff-view";
import {
  CsvIntelligencePanel,
  JsonIntelligencePanel,
  SqlIntelligencePanel,
} from "@/features/text-compare/components/intelligence-panels";
import { SourceInput } from "@/features/text-compare/components/source-input";
import { SummaryPanel } from "@/features/text-compare/components/summary-panel";
import { useTextCompare } from "@/features/text-compare/hooks/use-text-compare";
import { useUnsavedWorkWarning } from "@/hooks/use-unsaved-work-warning";
import type { ComparisonInputType } from "@/types/text-compare";

const TYPE_OPTIONS: { value: ComparisonInputType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "xml", label: "XML" },
  { value: "sql", label: "SQL" },
  { value: "lookml", label: "LookML" },
  { value: "dax", label: "DAX" },
];

export function TextCompareModule() {
  const {
    fileA,
    textA,
    fileB,
    textB,
    typeOverride,
    isComparing,
    isExporting,
    error,
    result,
    hasInputA,
    hasInputB,
    setFileA,
    setTextA,
    setFileB,
    setTextB,
    setTypeOverride,
    compare,
    exportReport,
  } = useTextCompare();

  useUnsavedWorkWarning(hasInputA || hasInputB);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Quick Help: </span>
        Compare text, CSV, JSON, YAML, XML, SQL, or LookML content side-by-side. Upload a file or
        paste content on either side - mixing input methods is fully supported.
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SourceInput label="Version A" file={fileA} text={textA} disabled={isComparing} onSelectFile={setFileA} onChangeText={setTextA} />
        <SourceInput label="Version B" file={fileB} text={textB} disabled={isComparing} onSelectFile={setFileB} onChangeText={setTextB} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <Button disabled={!hasInputA || !hasInputB || isComparing} onClick={compare}>
            {isComparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitCompare className="mr-2 h-4 w-4" />}
            Compare
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Comparison Type:</span>
            <button
              type="button"
              onClick={() => setTypeOverride(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                typeOverride === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Auto-detect
            </button>
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTypeOverride(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  typeOverride === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
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
              {result.file_name_a} (detected: {result.detected_type_a}) vs {result.file_name_b} (detected:{" "}
              {result.detected_type_b}) &middot; compared as <span className="font-medium">{result.input_type}</span>
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

          {result.csv_detail ? <CsvIntelligencePanel detail={result.csv_detail} /> : null}
          {result.structured_detail ? <JsonIntelligencePanel detail={result.structured_detail} /> : null}
          {result.sql_detail ? <SqlIntelligencePanel detail={result.sql_detail} /> : null}

          <DiffView lines={result.text_detail.lines} labelA={result.file_name_a} labelB={result.file_name_b} />
        </div>
      ) : null}
    </div>
  );
}
