"use client";

import { AlertCircle, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { DataGrid } from "@/features/parquet/modules/reader/components/data-grid";
import { OverviewPanel } from "@/features/parquet/modules/reader/components/overview-panel";
import { ReaderDropZone } from "@/features/parquet/modules/reader/components/reader-drop-zone";
import { SchemaPanel } from "@/features/parquet/modules/reader/components/schema-panel";
import { useParquetReader } from "@/features/parquet/modules/reader/hooks/use-parquet-reader";
import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";
import type { ParquetHandoffOrigin } from "@/store/use-parquet-handoff-store";

const ORIGIN_LABELS: Record<ParquetHandoffOrigin, string> = {
  convert: "Convert Files",
};

export function ReaderModule() {
  const {
    file,
    origin,
    isUploading,
    isLoadingRows,
    error,
    metadata,
    columns,
    rows,
    totalRowCount,
    offset,
    limit,
    hasResult,
    selectFile,
    setError,
    upload,
    goToPage,
    setLimit,
    reset,
  } = useParquetReader();

  // Warn while a file is selected/uploading or once it has been loaded and
  // is being explored — leaving the page at any of those points loses state.
  // Only the untouched, empty starting state has nothing to lose.
  useUnsavedWorkWarning(Boolean(file));

  return (
    <div className="flex flex-col gap-6">
      {origin ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span>
            Automatically loaded from <span className="font-medium">{ORIGIN_LABELS[origin]}</span> —
            no re-upload needed.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Drag and drop a .parquet file, or select one manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReaderDropZone
            file={file}
            disabled={isUploading}
            onSelect={selectFile}
            onReject={setError}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => void upload()} disabled={!file || isUploading || hasResult}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isUploading ? "Reading..." : hasResult ? "Loaded" : "Read Parquet"}
        </Button>
        {file || hasResult || error ? (
          <Button variant="ghost" onClick={reset} disabled={isUploading}>
            Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Could not read file</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {metadata ? (
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="mt-4">
            <DataGrid
              columns={columns}
              rows={rows}
              offset={offset}
              limit={limit}
              totalRowCount={totalRowCount}
              isLoadingRows={isLoadingRows}
              onPageChange={goToPage}
              onLimitChange={setLimit}
            />
          </TabsContent>
          <TabsContent value="schema" className="mt-4">
            <SchemaPanel columns={columns} />
          </TabsContent>
          <TabsContent value="overview" className="mt-4">
            <OverviewPanel metadata={metadata} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState
          title="No file loaded"
          description="Upload a parquet file to explore its data, schema, and statistics."
        />
      )}
    </div>
  );
}
