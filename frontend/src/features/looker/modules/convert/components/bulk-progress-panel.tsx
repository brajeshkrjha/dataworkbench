"use client";

import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BulkDiscoverySummary, BulkJobStatusResult, BulkJobSummaryResult } from "@/types/looker";

function DiscoveryTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "danger" && value > 0
            ? "text-red-600 dark:text-red-400"
            : tone === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BulkDiscoveryPanel({ discovery }: { discovery: BulkDiscoverySummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Discovery</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <DiscoveryTile label="Projects Found" value={discovery.found} />
          <DiscoveryTile label="Valid" value={discovery.valid} tone="success" />
          <DiscoveryTile label="Invalid" value={discovery.invalid} tone="danger" />
        </div>
        {discovery.invalid_projects.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1">
            {discovery.invalid_projects.map((project) => (
              <p key={project.project_name} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{project.project_name}</span> — {project.reason}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BulkProgressPanel({ status }: { status: BulkJobStatusResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {status.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Overall Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {status.processed} / {status.total} Projects Processed
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }}
          />
        </div>
        {status.current_project ? (
          <p className="text-xs text-muted-foreground">
            Processing: <span className="font-medium text-foreground">{status.current_project}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function BulkSummaryPanel({
  summary,
  onDownloadZip,
  onDownloadReport,
}: {
  summary: BulkJobSummaryResult;
  onDownloadZip: () => void;
  onDownloadReport: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Result Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <DiscoveryTile label="Processed" value={summary.processed} />
          <DiscoveryTile label="Successful" value={summary.successful} tone="success" />
          <DiscoveryTile label="Failed" value={summary.failed} tone="danger" />
        </div>

        {summary.failures.length > 0 ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              Failures
            </p>
            <div className="flex flex-col gap-1.5">
              {summary.failures.map((failure) => (
                <div key={failure.project_name} className="rounded-md border border-border p-2 text-sm">
                  <p className="font-medium">{failure.project_name}</p>
                  <p className="text-xs text-muted-foreground">{failure.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {summary.successes.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Successful Projects</p>
            <div className="flex flex-wrap gap-1">
              {summary.successes.map((success) => (
                <Badge key={success.project_name} variant="success">
                  {success.project_name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button onClick={onDownloadZip} disabled={summary.status !== "completed"}>
            <Download className="h-3.5 w-3.5" />
            Download Generated_LookML_Projects.zip
          </Button>
          <Button variant="outline" onClick={onDownloadReport}>
            <Download className="h-3.5 w-3.5" />
            Download summary report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
