"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfilingTab } from "@/features/parquet/modules/analyzer/components/profiling-tab";
import { SamplingTab } from "@/features/parquet/modules/analyzer/components/sampling-tab";
import { StatisticsTab } from "@/features/parquet/modules/analyzer/components/statistics-tab";
import { StorageTab } from "@/features/parquet/modules/analyzer/components/storage-tab";
import { useParquetAnalyzer } from "@/features/parquet/modules/analyzer/hooks/use-parquet-analyzer";
import { OverviewPanel } from "@/features/parquet/modules/reader/components/overview-panel";
import { ReaderDropZone } from "@/features/parquet/modules/reader/components/reader-drop-zone";
import { SchemaPanel } from "@/features/parquet/modules/reader/components/schema-panel";
import { useUnsavedWorkWarning } from "@/features/parquet/shared/use-unsaved-work-warning";

export function AnalyzerModule() {
  const {
    file,
    isUploading,
    error,
    overview,
    columns,
    statistics,
    isLoadingStatistics,
    storage,
    isLoadingStorage,
    sample,
    isLoadingSample,
    selectedColumn,
    profile,
    isLoadingProfile,
    hasResult,
    selectFile,
    setError,
    upload,
    loadStatistics,
    loadStorage,
    loadSample,
    selectColumn,
    reset,
  } = useParquetAnalyzer();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Warn while a file is selected/being explored — leaving the page loses
  // the current session and any tab-specific selections made so far.
  useUnsavedWorkWarning(Boolean(file));

  useEffect(() => {
    if (!hasResult) return;
    if (activeTab === "statistics") void loadStatistics();
    if (activeTab === "storage") void loadStorage();
  }, [activeTab, hasResult, loadStatistics, loadStorage]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Drag and drop a .parquet file, or select one manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReaderDropZone file={file} disabled={isUploading} onSelect={selectFile} onReject={setError} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => void upload()} disabled={!file || isUploading || hasResult}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isUploading ? "Analyzing..." : hasResult ? "Loaded" : "Analyze"}
        </Button>
        {file || hasResult || error ? (
          <Button variant="ghost" onClick={reset} disabled={isUploading}>
            Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Could not analyze file</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {overview ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Quick Help: </span>
            Use the tabs below to explore this file&apos;s structure, statistics, and storage. Search
            filters columns by name, type, or metadata across every tab — nothing is loaded until
            its tab is opened, so this stays fast on files with millions of rows.
          </div>

          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search columns, types, or statistics"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search columns, types, or statistics..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Tabs defaultValue="overview" onValueChange={setActiveTab} className="[&>div:first-child]:flex-wrap">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              <TabsTrigger value="profiling">Column Profiling</TabsTrigger>
              <TabsTrigger value="sampling">Sampling</TabsTrigger>
              <TabsTrigger value="storage">Storage Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewPanel metadata={overview} />
            </TabsContent>

            <TabsContent value="schema" className="mt-4">
              <SchemaPanel columns={filterColumns(columns, searchQuery)} />
            </TabsContent>

            <TabsContent value="statistics" className="mt-4">
              <StatisticsTab statistics={statistics} isLoading={isLoadingStatistics} searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="profiling" className="mt-4">
              <ProfilingTab
                columns={columns}
                searchQuery={searchQuery}
                selectedColumn={selectedColumn}
                profile={profile}
                isLoadingProfile={isLoadingProfile}
                onSelectColumn={(name) => void selectColumn(name)}
              />
            </TabsContent>

            <TabsContent value="sampling" className="mt-4">
              <SamplingTab
                columns={columns}
                sample={sample}
                isLoading={isLoadingSample}
                onLoadSample={(mode, size) => void loadSample(mode, size)}
              />
            </TabsContent>

            <TabsContent value="storage" className="mt-4">
              <StorageTab storage={storage} isLoading={isLoadingStorage} searchQuery={searchQuery} />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}

function filterColumns<T extends { name: string; data_type: string }>(columns: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return columns;
  return columns.filter((col) => col.name.toLowerCase().includes(q) || col.data_type.toLowerCase().includes(q));
}
