import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import type { ParquetFileMetadata } from "@/types/parquet";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Statistics Overview: totals only, no profiling. Row/column counts and
 * file size come straight from the parquet footer (already fetched at
 * upload time), so this never has to scan row data.
 */
export function OverviewPanel({ metadata }: { metadata: ParquetFileMetadata }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total rows" value={metadata.row_count.toLocaleString()} />
          <StatCard label="Total columns" value={metadata.column_count.toLocaleString()} />
          <StatCard label="File size" value={formatBytes(metadata.file_size_bytes)} />
          <StatCard label="Row groups" value={metadata.row_group_count.toLocaleString()} />
          <StatCard label="Compression" value={metadata.compression ?? "Unknown"} />
          <StatCard label="Written by" value={metadata.created_by ?? "Unknown"} />
        </div>
      </CardContent>
    </Card>
  );
}
