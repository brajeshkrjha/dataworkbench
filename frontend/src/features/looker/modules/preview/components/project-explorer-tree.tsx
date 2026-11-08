"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileCode2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download-blob";
import { cn } from "@/lib/utils";

export interface PreviewFileNode {
  key: string;
  displayName: string;
  fileName: string;
  lookml: string;
  meta?: string;
}

function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, fileName);
}

function TreeGroup({
  label,
  nodes,
  selectedKey,
  onSelect,
}: {
  label: string;
  nodes: PreviewFileNode[];
  selectedKey: string | null;
  onSelect: (node: PreviewFileNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label} ({nodes.length})
      </button>
      {expanded ? (
        <div className="flex flex-col gap-0.5 pl-4">
          {nodes.map((node) => (
            <button
              key={node.key}
              type="button"
              onClick={() => onSelect(node)}
              className={cn(
                "flex items-center gap-2 truncate rounded-md px-2 py-1 text-left text-sm",
                selectedKey === node.key ? "bg-accent font-medium" : "hover:bg-muted/60"
              )}
            >
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{node.displayName}</span>
            </button>
          ))}
          {nodes.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">None</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectExplorerTree({
  modelNode,
  views,
  explores,
  selectedKey,
  onSelect,
}: {
  modelNode: PreviewFileNode;
  views: PreviewFileNode[];
  explores: PreviewFileNode[];
  selectedKey: string | null;
  onSelect: (node: PreviewFileNode) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredViews = useMemo(
    () => views.filter((v) => v.displayName.toLowerCase().includes(query.toLowerCase())),
    [views, query]
  );
  const filteredExplores = useMemo(
    () => explores.filter((e) => e.displayName.toLowerCase().includes(query.toLowerCase())),
    [explores, query]
  );
  const matchesModel = modelNode.displayName.toLowerCase().includes(query.toLowerCase());

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search project"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="max-h-[36rem] overflow-auto">
        {matchesModel ? (
          <button
            type="button"
            onClick={() => onSelect(modelNode)}
            className={cn(
              "mb-2 flex w-full items-center gap-2 truncate rounded-md px-2 py-1 text-left text-sm font-medium",
              selectedKey === modelNode.key ? "bg-accent" : "hover:bg-muted/60"
            )}
          >
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {modelNode.displayName}
          </button>
        ) : null}
        <TreeGroup label="Views" nodes={filteredViews} selectedKey={selectedKey} onSelect={onSelect} />
        <TreeGroup label="Explores" nodes={filteredExplores} selectedKey={selectedKey} onSelect={onSelect} />
      </div>
    </div>
  );
}

export function DownloadFileButton({ node }: { node: PreviewFileNode }) {
  return (
    <Button variant="outline" size="sm" onClick={() => downloadText(node.fileName, node.lookml)}>
      <Download className="h-3.5 w-3.5" />
      Download file
    </Button>
  );
}
