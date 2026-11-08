"use client";

import type { ColumnSchema, ParquetFileMetadata } from "@/types/parquet";

/**
 * Pre-conversion preview for the "From Parquet" direction: row/column
 * counts and schema summary, read once from the upload response (no
 * duplicate parsing — reuses the same metadata/schema the Reader and
 * Analyzer modules already expose for an uploaded session).
 */
export function CsvPreviewPanel({
  metadata,
  columns,
}: {
  metadata: ParquetFileMetadata;
  columns: ColumnSchema[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Row count" value={metadata.row_count.toLocaleString()} />
        <Stat label="Column count" value={String(metadata.column_count)} />
        <Stat label="Row groups" value={String(metadata.row_group_count)} />
      </dl>

      <div>
        <p className="mb-2 text-sm font-medium">Schema summary</p>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Column</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Nullable</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column.name} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono">{column.name}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{column.data_type}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{column.nullable ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium">{value}</dd>
    </div>
  );
}
