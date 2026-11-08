import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchemaDriftAnalysis } from "@/types/parquet";

/** Schema Drift Score: a single number ops teams can alert on (e.g. "page
 * us if drift < 90%"), plus a plain-English explanation of what changed. */
export function DriftPanel({ drift }: { drift: SchemaDriftAnalysis }) {
  const matchColor =
    drift.match_percentage >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : drift.match_percentage >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schema Drift</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Match</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${matchColor}`}>{drift.match_percentage}%</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Drift Score</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{drift.drift_score}%</p>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${drift.match_percentage}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground">{drift.explanation}</p>
      </CardContent>
    </Card>
  );
}
