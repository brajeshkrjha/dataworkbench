import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparisonSummary, RiskLevel } from "@/types/text-compare";

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: string; className: string }> = {
  high: {
    label: "High Risk",
    icon: "\u274c",
    className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  },
  medium: {
    label: "Medium Risk",
    icon: "\u26a0\ufe0f",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  },
  low: {
    label: "Low Risk",
    icon: "\u2139\ufe0f",
    className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  },
  none: {
    label: "No Differences",
    icon: "\u2705",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
};

/** Top-level dashboard: similarity score, risk indicator, and diff
 * counts - the first thing a reviewer should see. */
export function SummaryPanel({ summary }: { summary: ComparisonSummary }) {
  const risk = RISK_CONFIG[summary.risk_level];

  const cards = [
    { label: "Added", value: summary.added_count },
    { label: "Removed", value: summary.removed_count },
    { label: "Modified", value: summary.modified_count },
    { label: "Identical", value: summary.identical_count },
    { label: "Total Differences", value: summary.total_differences },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium ${risk.className}`}>
        <span className="flex items-center gap-2">
          <span>{risk.icon}</span>
          <span>{risk.label}</span>
        </span>
        <span className="text-lg font-semibold tabular-nums">{summary.similarity_score}% Match</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
