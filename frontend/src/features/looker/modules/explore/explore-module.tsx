"use client";

import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropZone } from "@/features/looker/modules/convert/components/file-drop-zone";
import {
  LineageViewer,
  MeasureExplorer,
  OverviewPanel,
  RelationshipExplorer,
  StatisticsPanel,
  TableExplorer,
} from "@/features/looker/modules/explore/components/explore-panels";
import type {
  ExploreLineageEntry,
  ExploreMeasure,
  ExploreRelationship,
  ExploreRole,
  ExploreLargestTable,
  ExploreTable,
} from "@/features/looker/modules/explore/types";
import { usePbipUpload } from "@/features/looker/shared/use-pbip-upload";
import { lookerService } from "@/services/looker-service";
import type { PbipStructureResult } from "@/types/looker";

export function ExploreModule() {
  const { project, validation, isLoading, error, result, selectEntries, setError, reset, run } =
    usePbipUpload<PbipStructureResult>(lookerService.explorePbipStructure);

  const canRun = Boolean(project) && validation.status === "valid" && !isLoading && !result;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Select the PBIP project you want to explore.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropZone project={project} disabled={isLoading} onSelect={selectEntries} onReject={setError} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button onClick={() => void run()} disabled={!canRun}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isLoading ? "Analyzing..." : result ? "Analyzed" : "Analyze Structure"}
        </Button>
        {project || result || error ? (
          <Button variant="ghost" onClick={reset} disabled={isLoading}>
            Reset
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Analysis failed</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {result ? (
        <Tabs defaultValue="overview" className="flex flex-col gap-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
            <TabsTrigger value="measures">Measures</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewPanel stats={result.stats} />
          </TabsContent>
          <TabsContent value="tables">
            <TableExplorer tables={result.tables as unknown as ExploreTable[]} />
          </TabsContent>
          <TabsContent value="relationships">
            <RelationshipExplorer relationships={result.relationships as unknown as ExploreRelationship[]} />
          </TabsContent>
          <TabsContent value="measures">
            <MeasureExplorer measures={result.measures as unknown as ExploreMeasure[]} />
          </TabsContent>
          <TabsContent value="lineage">
            <LineageViewer lineage={result.lineage as unknown as ExploreLineageEntry[]} />
          </TabsContent>
          <TabsContent value="statistics">
            <StatisticsPanel
              unusedMeasures={result.unused_measures}
              unusedTables={result.unused_tables}
              largestTables={result.largest_tables as unknown as ExploreLargestTable[]}
              roles={result.roles as unknown as ExploreRole[]}
            />
          </TabsContent>
        </Tabs>
      ) : !isLoading ? (
        <EmptyState
          title="No analysis yet"
          description="Select a PBIP project and analyze it to see its structure here."
        />
      ) : null}
    </div>
  );
}
