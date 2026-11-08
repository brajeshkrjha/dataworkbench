"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { BulkUploadDropZone } from "@/features/looker/modules/convert/components/bulk-upload-drop-zone";
import {
  BulkDiscoveryPanel,
  BulkProgressPanel,
  BulkSummaryPanel,
} from "@/features/looker/modules/convert/components/bulk-progress-panel";
import { ConversionResultPanel } from "@/features/looker/modules/convert/components/conversion-result";
import { FileDropZone } from "@/features/looker/modules/convert/components/file-drop-zone";
import { ValidationPanel } from "@/features/looker/modules/convert/components/validation-panel";
import { useBulkConversion } from "@/features/looker/modules/convert/hooks/use-bulk-conversion";
import { useLookerConversion } from "@/features/looker/modules/convert/hooks/use-looker-conversion";
import { useUnsavedWorkWarning } from "@/features/looker/shared/use-unsaved-work-warning";

export function ConvertModule() {
  const {
    project,
    validation,
    isConverting,
    error,
    result,
    downloadUrl,
    hasUnsavedWork,
    selectEntries,
    setError,
    markDownloaded,
    convert,
    reset,
  } = useLookerConversion();

  const bulk = useBulkConversion();

  useUnsavedWorkWarning(hasUnsavedWork);
  useUnsavedWorkWarning(bulk.hasUnsavedWork);

  const isCompleted = result !== null && !isConverting;
  const canConvert = Boolean(project) && validation.status === "valid" && !isConverting && !isCompleted;

  return (
    <Tabs defaultValue="single" className="flex flex-col gap-6">
      <TabsList>
        <TabsTrigger value="single">Single Project</TabsTrigger>
        <TabsTrigger value="bulk">Bulk Conversion</TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Single Project: upload one PBIP project folder and convert it to LookML.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>
              Drag and drop your PBIP project, or select it manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropZone
              project={project}
              disabled={isConverting}
              onSelect={selectEntries}
              onReject={setError}
            />
          </CardContent>
        </Card>

        {project ? (
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
              <CardDescription>Structural checks run on the project before conversion.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValidationPanel validation={validation} selectedFileCount={project?.fileCount ?? 0} />
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center gap-3">
          <Button onClick={() => void convert()} disabled={!canConvert}>
            {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : null}
            {isConverting
              ? "Generating LookML..."
              : isCompleted
                ? "Generated"
                : "Generate LookML Package"}
          </Button>
          {project || result || error ? (
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
            <CardDescription>The generated LookML package and its statistics.</CardDescription>
          </CardHeader>
          <CardContent>
            {result && downloadUrl ? (
              <ConversionResultPanel
                result={result}
                downloadUrl={downloadUrl}
                onDownload={markDownloaded}
              />
            ) : (
              <EmptyState
                title="No conversion yet"
                description="Select your PBIP project and generate a LookML package to see the result here."
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bulk" className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Bulk Conversion: upload a parent folder containing multiple PBIP projects. Each
          project is discovered and converted automatically — no manual selection needed.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>
              Drag and drop the parent folder, or select it manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BulkUploadDropZone
              folder={bulk.folder}
              disabled={bulk.isUploading || bulk.isProcessing}
              onSelect={bulk.selectEntries}
              onReject={bulk.setError}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={() => void bulk.start()} disabled={!bulk.canStart}>
            {bulk.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {bulk.isUploading ? "Uploading..." : "Start Bulk Conversion"}
          </Button>
          {bulk.folder || bulk.summary || bulk.error ? (
            <Button variant="ghost" onClick={bulk.reset} disabled={bulk.isUploading || bulk.isProcessing}>
              Reset
            </Button>
          ) : null}
        </div>

        {bulk.error ? (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Bulk conversion failed
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{bulk.error}</p>
            </div>
          </div>
        ) : null}

        {bulk.discovery ? <BulkDiscoveryPanel discovery={bulk.discovery} /> : null}
        {bulk.status ? <BulkProgressPanel status={bulk.status} /> : null}
        {bulk.summary ? (
          <BulkSummaryPanel
            summary={bulk.summary}
            onDownloadZip={() => void bulk.downloadZip()}
            onDownloadReport={() => void bulk.downloadReport()}
          />
        ) : null}
      </TabsContent>
    </Tabs>
  );
}

