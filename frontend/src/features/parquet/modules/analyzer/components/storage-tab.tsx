import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatBytes } from "@/features/parquet/shared/format-bytes";
import type { StorageAnalysis } from "@/types/parquet";

/** Storage Analysis tab: compression ratios and per-row-group/per-column
 * byte breakdown, all derived from footer metadata (no data read). */
export function StorageTab({
  storage,
  isLoading,
  searchQuery,
}: {
  storage: StorageAnalysis | null;
  isLoading: boolean;
  searchQuery: string;
}) {
  if (isLoading || !storage) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading storage analysis...
        </CardContent>
      </Card>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const columns = query ? storage.columns.filter((col) => col.name.toLowerCase().includes(query)) : storage.columns;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Compression" value={storage.compression ?? "Unknown"} />
        <StatCard label="Compressed size" value={formatBytes(storage.total_compressed_bytes)} />
        <StatCard label="Uncompressed size" value={formatBytes(storage.total_uncompressed_bytes)} />
        <StatCard label="Compression ratio" value={`${storage.overall_compression_ratio.toFixed(2)}x`} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Row groups</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">#</th>
                <th className="px-3 py-1.5 font-medium">Rows</th>
                <th className="px-3 py-1.5 font-medium">Compressed</th>
                <th className="px-3 py-1.5 font-medium">Uncompressed</th>
              </tr>
            </thead>
            <tbody>
              {storage.row_groups.map((rg) => (
                <tr key={rg.index} className="border-t border-border">
                  <td className="px-3 py-1.5">{rg.index}</td>
                  <td className="px-3 py-1.5">{rg.row_count.toLocaleString()}</td>
                  <td className="px-3 py-1.5">{formatBytes(rg.compressed_size_bytes)}</td>
                  <td className="px-3 py-1.5">{formatBytes(rg.uncompressed_size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Per-column storage</CardTitle>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <EmptyState title="No matching columns" description="Try a different search term." />
          ) : (
            <ul className="space-y-2">
              {columns.map((col) => (
                <li key={col.name} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="truncate font-mono">{col.name}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatBytes(col.compressed_size_bytes)}</span>
                    <Badge variant="secondary">{col.compression_ratio.toFixed(2)}x</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
