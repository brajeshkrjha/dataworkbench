import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparisonSummary, SchemaHealth } from "@/types/parquet";

const HEALTH_CONFIG: Record<SchemaHealth, { label: string; icon: string; className: string }> = {
  matching: {
    label: "Matching",
    icon: "\u2705",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  minor_differences: {
    label: "Minor Differences",
    icon: "\u26a0\ufe0f",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  breaking_changes: {
    label: "Breaking Changes",
    icon: "\u274c",
    className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
};

/** Summary cards + a top-level health indicator, the first thing a data
 * engineer should see: is this schema change safe to ship? */
export function ComparisonSummaryCards({ summary }: { summary: ComparisonSummary }) {
  const health = HEALTH_CONFIG[summary.health];

  const cards = [
    { label: "Columns Added", value: summary.columns_added },
    { label: "Columns Removed", value: summary.columns_removed },
    { label: "Columns Modified", value: summary.columns_modified },
    { label: "Type Changes", value: summary.type_changes },
    { label: "Nullability Changes", value: summary.nullability_changes },
    { label: "Identical Columns", value: summary.identical_columns },
    { label: "Total Differences", value: summary.total_differences },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${health.className}`}>
        <span>{health.icon}</span>
        <span>{health.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">{card.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
