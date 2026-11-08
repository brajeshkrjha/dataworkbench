"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConversionOptions } from "@/features/parquet/modules/convert/components/conversion-options";
import { ConversionResultPanel } from "@/features/parquet/modules/convert/components/conversion-result";
import { FileDropZone } from "@/features/parquet/modules/convert/components/file-drop-zone";
import { SchemaMappingPanel } from "@/features/parquet/modules/convert/components/schema-mapping-panel";
import { SourceFormatSelector } from "@/features/parquet/modules/convert/components/source-format-selector";
import { SCHEMA_MAPPING_SUPPORTED_FORMATS } from "@/features/parquet/modules/convert/constants";
import { useParquetConversion } from "@/features/parquet/modules/convert/hooks/use-parquet-conversion";
import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";
import { useParquetHandoffStore } from "@/store/use-parquet-handoff-store";

/** "To Parquet" direction: CSV/JSON/Excel/TSV/XML/Avro/ORC -> Parquet. */
export function ToParquetPanel() {
  const router = useRouter();
  const {
    sourceFormat,
    file,
    compression,
    outputFileName,
    isConverting,
    error,
    result,
    resultBlob,
    downloadUrl,
    hasUnsavedWork,
    schema,
    isInspectingSchema,
    schemaError,
    columnOverrides,
    selectSourceFormat,
    selectFile,
    setCompression,
    setOutputFileName,
    setError,
    markDownloaded,
    convert,
    reset,
    inspectSchema,
    setColumnType,
    setAllColumnsTo,
    resetToAutoDetect,
  } = useParquetConversion();

  useUnsavedWorkWarning(hasUnsavedWork);

  const defaultOutputName = file ? file.name.replace(/\.[^.]+$/, "") : "converted";
  const isCompleted = result !== null && !isConverting;
  const supportsSchemaMapping = SCHEMA_MAPPING_SUPPORTED_FORMATS.includes(sourceFormat.id);

  const openInReader = () => {
    if (!result || !resultBlob) return;
    useParquetHandoffStore.getState().setPending({
      blob: resultBlob,
      fileName: result.fileName,
      origin: "convert",
    });
    markDownloaded();
    router.push("/tools/parquet-utility/reader");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Source format</CardTitle>
          <CardDescription>Choose the format of the file you want to convert.</CardDescription>
        </CardHeader>
        <CardContent>
          <SourceFormatSelector
            selected={sourceFormat}
            disabled={isConverting}
            onSelect={selectSourceFormat}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Drag and drop a file, or select one manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropZone
            format={sourceFormat}
            file={file}
            disabled={isConverting}
            onSelect={selectFile}
            onReject={setError}
          />
        </CardContent>
      </Card>

      {supportsSchemaMapping && file ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Schema &amp; Datatypes</CardTitle>
              <CardDescription>
                Inspect the detected schema and optionally override column datatypes.
              </CardDescription>
            </div>
            {!schema && !isInspectingSchema ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void inspectSchema()}
                disabled={isConverting}
              >
                Inspect Schema
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <SchemaMappingPanel
              schema={schema}
              columnOverrides={columnOverrides}
              isInspecting={isInspectingSchema}
              error={schemaError}
              onSetColumnType={setColumnType}
              onSetAllColumnsTo={setAllColumnsTo}
              onResetToAutoDetect={resetToAutoDetect}
              disabled={isConverting}
            />
            {!schema && !isInspectingSchema && !schemaError ? (
              <EmptyState
                title="No schema inspected yet"
                description="Inspect the schema to review and adjust detected datatypes, or skip this step to use automatic inference."
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
          <CardDescription>
            Defaults are tuned for typical data engineering workloads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConversionOptions
            compression={compression}
            outputFileName={outputFileName}
            defaultOutputName={defaultOutputName}
            disabled={isConverting}
            onCompressionChange={setCompression}
            onOutputFileNameChange={setOutputFileName}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => void convert()} disabled={!file || isConverting || isCompleted}>
          {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : null}
          {isConverting ? "Converting..." : isCompleted ? "Converted" : "Convert to Parquet"}
        </Button>
        {file || result || error ? (
          <Button variant="ghost" onClick={reset} disabled={isConverting}>
            Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Conversion failed
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>The generated parquet file and its statistics.</CardDescription>
        </CardHeader>
        <CardContent>
          {result && downloadUrl ? (
            <ConversionResultPanel
              result={result}
              downloadUrl={downloadUrl}
              onDownload={markDownloaded}
              onOpenInReader={resultBlob ? openInReader : undefined}
            />
          ) : (
            <EmptyState
              title="No conversion yet"
              description="Upload a file and run a conversion to see the result here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
