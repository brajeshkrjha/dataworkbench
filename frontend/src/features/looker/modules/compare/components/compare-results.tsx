"use client";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { LookmlCompareResult } from "@/types/looker";

interface ViewChange {
  view_name: string;
  fields_added: string[];
  fields_removed: string[];
}

interface ExploreChange {
  explore_name: string;
  joins_added: string[];
  joins_removed: string[];
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "default" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "danger" && value > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function sourceTypeLabel(sourceType: string): string {
  return sourceType === "lookml_package" ? "LookML Package" : sourceType === "pbip_project" ? "PBIP Project" : sourceType;
}

function SourceBadge({ label, projectName, sourceType }: { label: string; projectName: string; sourceType: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">
        {sourceTypeLabel(sourceType)} <span className="text-muted-foreground">/</span> {projectName}
      </p>
    </div>
  );
}

function NameList({ names, tone }: { names: string[]; tone: "added" | "removed" }) {
  if (names.length === 0) return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((name) => (
        <Badge key={name} variant={tone === "added" ? "success" : "warning"}>
          {tone === "added" ? "+" : "-"} {name}
        </Badge>
      ))}
    </div>
  );
}

export function CompareResults({ result }: { result: LookmlCompareResult }) {
  const viewChanges = result.view_changes as unknown as ViewChange[];
  const exploreChanges = result.explore_changes as unknown as ExploreChange[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {result.project_name_a} <span className="text-muted-foreground">vs</span> {result.project_name_b}
        </p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <SourceBadge label="Source A: Type / Name" projectName={result.project_name_a} sourceType={result.source_type_a} />
          <SourceBadge label="Source B: Type / Name" projectName={result.project_name_b} sourceType={result.source_type_b} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryTile label="Views added" value={result.summary.views_added} />
          <SummaryTile label="Views removed" value={result.summary.views_removed} tone="danger" />
          <SummaryTile label="Views changed" value={result.summary.views_changed} />
          <SummaryTile label="Explores added" value={result.summary.explores_added} />
          <SummaryTile label="Explores removed" value={result.summary.explores_removed} tone="danger" />
          <SummaryTile label="Explores changed" value={result.summary.explores_changed} />
        </div>
      </div>

      {result.risk_flags.length > 0 ? (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Risk flags ({result.risk_flags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {result.risk_flags.map((flag, index) => (
                <li key={index} className="text-amber-800 dark:text-amber-300">
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="No risks detected" description="No removed views, explores, or fields were found." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Views</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Added</p>
              <NameList names={result.views_added} tone="added" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Removed</p>
              <NameList names={result.views_removed} tone="removed" />
            </div>
            {viewChanges.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Changed</p>
                <div className="flex flex-col gap-2">
                  {viewChanges.map((change) => (
                    <div key={change.view_name} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-mono font-medium">{change.view_name}</p>
                      {change.fields_added.length > 0 ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          + {change.fields_added.join(", ")}
                        </p>
                      ) : null}
                      {change.fields_removed.length > 0 ? (
                        <p className="text-xs text-red-700 dark:text-red-400">- {change.fields_removed.join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Explores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Added</p>
              <NameList names={result.explores_added} tone="added" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Removed</p>
              <NameList names={result.explores_removed} tone="removed" />
            </div>
            {exploreChanges.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Changed</p>
                <div className="flex flex-col gap-2">
                  {exploreChanges.map((change) => (
                    <div key={change.explore_name} className="rounded-md border border-border p-2 text-sm">
                      <p className="font-mono font-medium">{change.explore_name}</p>
                      {change.joins_added.length > 0 ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          + {change.joins_added.join(", ")}
                        </p>
                      ) : null}
                      {change.joins_removed.length > 0 ? (
                        <p className="text-xs text-red-700 dark:text-red-400">- {change.joins_removed.join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function buildCompareReportMarkdown(result: LookmlCompareResult): string {
  const viewChanges = result.view_changes as unknown as ViewChange[];
  const exploreChanges = result.explore_changes as unknown as ExploreChange[];
  const lines: string[] = [
    `# LookML Comparison Report`,
    ``,
    `**Package A:** ${result.project_name_a} (${sourceTypeLabel(result.source_type_a)})`,
    `**Package B:** ${result.project_name_b} (${sourceTypeLabel(result.source_type_b)})`,
    ``,
    `## Summary`,
    `- Views added: ${result.summary.views_added}`,
    `- Views removed: ${result.summary.views_removed}`,
    `- Views changed: ${result.summary.views_changed}`,
    `- Explores added: ${result.summary.explores_added}`,
    `- Explores removed: ${result.summary.explores_removed}`,
    `- Explores changed: ${result.summary.explores_changed}`,
    ``,
    `## Risk Flags`,
    ...(result.risk_flags.length > 0 ? result.risk_flags.map((f) => `- ${f}`) : ["- None"]),
    ``,
    `## Views`,
    `Added: ${result.views_added.join(", ") || "none"}`,
    `Removed: ${result.views_removed.join(", ") || "none"}`,
    ...viewChanges.flatMap((c) => [
      `### ${c.view_name}`,
      ...(c.fields_added.length ? [`+ ${c.fields_added.join(", ")}`] : []),
      ...(c.fields_removed.length ? [`- ${c.fields_removed.join(", ")}`] : []),
    ]),
    ``,
    `## Explores`,
    `Added: ${result.explores_added.join(", ") || "none"}`,
    `Removed: ${result.explores_removed.join(", ") || "none"}`,
    ...exploreChanges.flatMap((c) => [
      `### ${c.explore_name}`,
      ...(c.joins_added.length ? [`+ ${c.joins_added.join(", ")}`] : []),
      ...(c.joins_removed.length ? [`- ${c.joins_removed.join(", ")}`] : []),
    ]),
  ];
  return lines.join("\n");
}
