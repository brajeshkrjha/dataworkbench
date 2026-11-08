"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CsvConversionResultPanel } from "@/features/parquet/modules/convert/components/csv-conversion-result";
import { CsvExportOptions } from "@/features/parquet/modules/convert/components/csv-export-options";
import { CsvPreviewPanel } from "@/features/parquet/modules/convert/components/csv-preview-panel";
import { FileDropZone } from "@/features/parquet/modules/convert/components/file-drop-zone";
import { TargetFormatSelector } from "@/features/parquet/modules/convert/components/target-format-selector";
import { useParquetCsvExport } from "@/features/parquet/modules/convert/hooks/use-parquet-csv-export";
import {
  PARQUET_UPLOAD_FORMAT,
  TARGET_FORMATS,
} from "@/features/parquet/shared/target-format-registry";
import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";
import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";

const CSV_TARGET_FORMAT = TARGET_FORMATS[0];

/**
 * "From Parquet" direction: Parquet -> CSV (today). Future exports
 * (JSON, Excel, TSV) are listed as "Planned" in `TargetFormatSelector`
 * and only need a registry entry once implemented.
 */
export function FromParquetPanel() {
  const router = useRouter();
  const {
    file,
    isUploading,
    fileId,
    metadata,
    columns,
    delimiter,
    includeHeader,
    quoting,
    outputFileName,
    isExporting,
    error,
    result,
    resultBlob,
    downloadUrl,
    hasUnsavedWork,
    selectFile,
    setDelimiter,
    setIncludeHeader,
    setQuoting,
    setOutputFileName,
    setError,
    markDownloaded,
    loadPreview,
    exportCsv,
    reset,
  } = useParquetCsvExport();

  useUnsavedWorkWarning(hasUnsavedWork);

  const defaultOutputName = file ? file.name.replace(/\.[^.]+$/, "") : "converted";
  const hasPreview = fileId !== null && metadata !== null;
  const isCompleted = result !== null && !isExporting;

  const openInReader = () => {
    if (!file) return;
    useParquetHandoffStore.getState().setPending({
      blob: file,
      fileName: file.name,
      origin: "convert",
    });
    markDownloaded();
    router.push("/tools/parquet-utility/reader");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Target format</CardTitle>
          <CardDescription>Choose the format to convert this parquet file into.</CardDescription>
        </CardHeader>
        <CardContent>
          <TargetFormatSelector selected={CSV_TARGET_FORMAT} disabled onSelect={() => undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Drag and drop a .parquet file, or select one manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropZone
            format={PARQUET_UPLOAD_FORMAT}
            file={file}
            disabled={isUploading || hasPreview}
            onSelect={selectFile}
            onReject={setError}
          />
        </CardContent>
      </Card>

      {!hasPreview ? (
        <div className="flex items-center gap-3">
          <Button onClick={() => void loadPreview()} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isUploading ? "Validating..." : "Validate & Preview"}
          </Button>
          {file || error ? (
            <Button variant="ghost" onClick={reset} disabled={isUploading}>
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Conversion failed</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {hasPreview && metadata ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Row count, column count, and schema — read once from the upload.</CardDescription>
            </CardHeader>
            <CardContent>
              <CsvPreviewPanel metadata={metadata} columns={columns} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CSV export options</CardTitle>
              <CardDescription>Defaults work without any configuration.</CardDescription>
            </CardHeader>
            <CardContent>
              <CsvExportOptions
                delimiter={delimiter}
                includeHeader={includeHeader}
                quoting={quoting}
                outputFileName={outputFileName}
                defaultOutputName={defaultOutputName}
                disabled={isExporting}
                onDelimiterChange={setDelimiter}
                onIncludeHeaderChange={setIncludeHeader}
                onQuotingChange={setQuoting}
                onOutputFileNameChange={setOutputFileName}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={() => void exportCsv()} disabled={isExporting || isCompleted}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : null}
              {isExporting ? "Converting..." : isCompleted ? "Converted" : "Convert to CSV"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={isExporting}>
              Reset
            </Button>
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>The generated CSV file and its statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          {result && downloadUrl ? (
            <CsvConversionResultPanel
              result={result}
              downloadUrl={downloadUrl}
              onDownload={markDownloaded}
              onOpenInReader={file ? openInReader : undefined}
            />
          ) : (
            <EmptyState
              title="No conversion yet"
              description="Upload a parquet file and run a conversion to see the result here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
