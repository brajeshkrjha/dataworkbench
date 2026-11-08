"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnProfile, ColumnSchema } from "@/types/parquet";

/** Column Profiling tab: pick one column, see a detailed distribution
 * profile. Only the selected column's data is ever fetched. */
export function ProfilingTab({
  columns,
  searchQuery,
  selectedColumn,
  profile,
  isLoadingProfile,
  onSelectColumn,
}: {
  columns: ColumnSchema[];
  searchQuery: string;
  selectedColumn: string | null;
  profile: ColumnProfile | null;
  isLoadingProfile: boolean;
  onSelectColumn: (name: string) => void;
}) {
  const filteredColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return columns;
    return columns.filter(
      (col) => col.name.toLowerCase().includes(query) || col.data_type.toLowerCase().includes(query)
    );
  }, [columns, searchQuery]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Columns</CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto p-2">
          {filteredColumns.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">No matching columns.</p>
          ) : (
            <ul className="space-y-1">
              {filteredColumns.map((col) => (
                <li key={col.name}>
                  <button
                    type="button"
                    onClick={() => onSelectColumn(col.name)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm font-mono transition-colors ${
                      selectedColumn === col.name
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {col.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        {!selectedColumn ? (
          <EmptyState title="Select a column" description="Choose a column on the left to see its profile." />
        ) : isLoadingProfile || !profile ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading profile...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-mono">{profile.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{profile.data_type}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Nulls" value={`${profile.null_count.toLocaleString()} (${profile.null_percentage}%)`} />
                  <Stat label="Distinct" value={profile.distinct_count.toLocaleString()} />
                  <Stat label="Cardinality" value={profile.cardinality_ratio.toFixed(3)} />
                  {profile.min_value ? <Stat label="Min" value={profile.min_value} /> : null}
                  {profile.max_value ? <Stat label="Max" value={profile.max_value} /> : null}
                  {profile.avg_value !== null && profile.avg_value !== undefined ? (
                    <Stat label="Average" value={profile.avg_value.toLocaleString(undefined, { maximumFractionDigits: 3 })} />
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Most common values</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.most_common_values.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No values found.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {profile.most_common_values.map((item, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-mono">{item.value ?? "(null)"}</span>
                        <Badge variant="secondary">{item.count.toLocaleString()}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm">{value}</p>
    </div>
  );
}
