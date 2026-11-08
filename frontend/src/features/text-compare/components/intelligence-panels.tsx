import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CsvComparisonDetail, SqlComparisonDetail, StructuredComparisonDetail } from "@/types/text-compare";

function ChipList({ items, variant }: { items: string[]; variant: "success" | "warning" }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

/** Structural intelligence for JSON/YAML/XML comparisons: key-path level
 * added/removed/modified counts plus the raw entry list. */
export function JsonIntelligencePanel({ detail }: { detail: StructuredComparisonDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Structured Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Keys Added" value={detail.keys_added} />
          <Metric label="Keys Removed" value={detail.keys_removed} />
          <Metric label="Values Changed" value={detail.values_changed} />
          <Metric label="Array Changes" value={detail.array_changes} />
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Path</th>
                <th className="px-2 py-1.5 text-left font-medium">Change</th>
                <th className="px-2 py-1.5 text-left font-medium">A</th>
                <th className="px-2 py-1.5 text-left font-medium">B</th>
              </tr>
            </thead>
            <tbody>
              {detail.entries.map((entry, index) => (
                <tr key={index} className="border-t border-border/50 font-mono">
                  <td className="px-2 py-1">{entry.path}</td>
                  <td className="px-2 py-1 capitalize">{entry.diff_type}</td>
                  <td className="max-w-xs truncate px-2 py-1">{entry.value_a ?? ""}</td>
                  <td className="max-w-xs truncate px-2 py-1">{entry.value_b ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Tabular intelligence for CSV comparisons: schema drift plus
 * row-level add/remove/modify counts. */
export function CsvIntelligencePanel({ detail }: { detail: CsvComparisonDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">CSV Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Rows A" value={detail.row_count_a} />
          <Metric label="Rows B" value={detail.row_count_b} />
          <Metric label="Rows Added" value={detail.rows_added} />
          <Metric label="Rows Removed" value={detail.rows_removed} />
          <Metric label="Rows Modified" value={detail.rows_modified} />
          <Metric label="Rows Identical" value={detail.rows_identical} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns Added</p>
          <ChipList items={detail.columns_added} variant="success" />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Columns Removed</p>
          <ChipList items={detail.columns_removed} variant="warning" />
        </div>
        <div className="max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Row</th>
                <th className="px-2 py-1.5 text-left font-medium">Change</th>
                <th className="px-2 py-1.5 text-left font-medium">Changed Columns</th>
              </tr>
            </thead>
            <tbody>
              {detail.rows
                .filter((row) => row.diff_type !== "identical")
                .map((row, index) => (
                  <tr key={index} className="border-t border-border/50 font-mono">
                    <td className="px-2 py-1">{row.row_index}</td>
                    <td className="px-2 py-1 capitalize">{row.diff_type}</td>
                    <td className="px-2 py-1">{row.changed_columns.join(", ")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** Query-aware intelligence for SQL comparisons: tables, joins, filters,
 * and selected columns compared as sets. */
export function SqlIntelligencePanel({ detail }: { detail: SqlComparisonDetail }) {
  const rows: { label: string; added: string[]; removed: string[] }[] = [
    { label: "Tables", added: detail.tables_added, removed: detail.tables_removed },
    { label: "Joins", added: detail.joins_added, removed: detail.joins_removed },
    { label: "Filters", added: detail.filters_added, removed: detail.filters_removed },
    { label: "Columns", added: detail.columns_added, removed: detail.columns_removed },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SQL Intelligence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-2 sm:grid-cols-[100px_1fr_1fr] sm:items-start">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <ChipList items={row.added} variant="success" />
            <ChipList items={row.removed} variant="warning" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
