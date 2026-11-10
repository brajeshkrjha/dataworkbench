"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FileDropZone } from "@/features/looker/modules/convert/components/file-drop-zone";
import {
  DownloadFileButton,
  ProjectExplorerTree,
  type PreviewFileNode,
} from "@/features/looker/modules/preview/components/project-explorer-tree";
import { CodeViewer } from "@/features/looker/shared/components/code-viewer";
import { usePbipUpload } from "@/features/looker/shared/use-pbip-upload";
import { buildStoredZip } from "@/features/looker/shared/zip-writer";
import { downloadBlob } from "@/lib/download-blob";
import { lookerService } from "@/services/looker-service";
import type { LookmlPreviewResult } from "@/types/looker";

interface PreviewView {
  view_name: string;
  table_name: string | null;
  file_name: string;
  lookml: string;
}

interface PreviewExplore {
  explore_name: string;
  table_name: string;
  file_name: string;
  join_count: number;
  lookml: string;
}

async function downloadWholePackage(result: LookmlPreviewResult) {
  const encoder = new TextEncoder();
  const views = result.views as unknown as PreviewView[];
  const explores = result.explores as unknown as PreviewExplore[];
  const entries = [
    { name: result.model_file_name, data: encoder.encode(result.model_text) },
    ...views.map((v) => ({ name: `views/${v.file_name}`, data: encoder.encode(v.lookml) })),
    ...explores.map((e) => ({ name: `explores/${e.file_name}`, data: encoder.encode(e.lookml) })),
  ];
  const zip = buildStoredZip(entries);
  downloadBlob(zip, `${result.project_name}_LookML_preview.zip`);
}

export function PreviewModule() {
  const { project, validation, isLoading, error, result, selectEntries, setError, reset, run } =
    usePbipUpload<LookmlPreviewResult>(lookerService.previewLookml);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const canRun = Boolean(project) && validation.status === "valid" && !isLoading && !result;

  const { modelNode, viewNodes, exploreNodes, selectedNode } = useMemo(() => {
    if (!result) {
      return { modelNode: null, viewNodes: [] as PreviewFileNode[], exploreNodes: [] as PreviewFileNode[], selectedNode: null };
    }
    const model: PreviewFileNode = {
      key: "model",
      displayName: result.model_file_name,
      fileName: result.model_file_name,
      lookml: result.model_text,
      meta: "model",
    };
    const views = (result.views as unknown as PreviewView[]).map((v) => ({
      key: `view:${v.view_name}`,
      displayName: v.view_name,
      fileName: v.file_name,
      lookml: v.lookml,
    }));
    const explores = (result.explores as unknown as PreviewExplore[]).map((e) => ({
      key: `explore:${e.explore_name}`,
      displayName: e.explore_name,
      fileName: e.file_name,
      lookml: e.lookml,
    }));
    const all = [model, ...views, ...explores];
    const selected = all.find((n) => n.key === selectedKey) ?? model;
    return { modelNode: model, viewNodes: views, exploreNodes: explores, selectedNode: selected };
  }, [result, selectedKey]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Select the PBIP project you want to preview.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropZone project={project} disabled={isLoading} onSelect={selectEntries} onReject={setError} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button onClick={() => void run()} disabled={!canRun}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isLoading ? "Generating preview..." : result ? "Generated" : "Generate Preview"}
        </Button>
        {result ? (
          <Button variant="outline" onClick={() => void downloadWholePackage(result)}>
            <Download className="h-3.5 w-3.5" />
            Download whole package
          </Button>
        ) : null}
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
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Preview generation failed</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {result && modelNode && selectedNode ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Project Explorer</CardTitle>
              <div className="flex gap-1.5 pt-1">
                <Badge variant="outline">{result.counts.views ?? 0} views</Badge>
                <Badge variant="outline">{result.counts.explores ?? 0} explores</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ProjectExplorerTree
                modelNode={modelNode}
                views={viewNodes}
                explores={exploreNodes}
                selectedKey={selectedNode.key}
                onSelect={(node) => setSelectedKey(node.key)}
              />
            </CardContent>
          </Card>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{selectedNode.displayName}</p>
              <DownloadFileButton node={selectedNode} />
            </div>
            <CodeViewer code={selectedNode.lookml} fileName={selectedNode.fileName} />
          </div>
        </div>
      ) : !isLoading ? (
        <EmptyState
          title="No preview yet"
          description="Select a PBIP project and generate a preview to browse its LookML here."
        />
      ) : null}
    </div>
  );
}
