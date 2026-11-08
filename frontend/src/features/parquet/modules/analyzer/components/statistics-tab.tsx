import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ParquetStatistics } from "@/types/parquet";

/** Statistics tab: per-column null/distinct/min/max/avg, in a compact grid
 * (never a raw HTML data dump) so it stays readable with hundreds of columns. */
export function StatisticsTab({
  statistics,
  isLoading,
  searchQuery,
}: {
  statistics: ParquetStatistics | null;
  isLoading: boolean;
  searchQuery: string;
}) {
  if (isLoading || !statistics) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading statistics...
        </CardContent>
      </Card>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const columns = query
    ? statistics.columns.filter(
        (col) =>
          col.name.toLowerCase().includes(query) || col.data_type.toLowerCase().includes(query)
      )
    : statistics.columns;

  if (columns.length === 0) {
    return <EmptyState title="No matching columns" description="Try a different search term." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((col) => (
        <Card key={col.name}>
          <CardHeader className="pb-2">
            <CardTitle className="truncate font-mono text-sm">{col.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{col.data_type}</p>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Nulls" value={`${col.null_count.toLocaleString()} (${col.null_percentage}%)`} />
            <Row
              label="Distinct"
              value={col.distinct_count !== null && col.distinct_count !== undefined ? col.distinct_count.toLocaleString() : "N/A"}
            />
            <Row label="Min" value={col.min_value ?? "N/A"} />
            <Row label="Max" value={col.max_value ?? "N/A"} />
            {col.avg_value !== null && col.avg_value !== undefined ? (
              <Row label="Average" value={col.avg_value.toLocaleString(undefined, { maximumFractionDigits: 3 })} />
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  );
}
