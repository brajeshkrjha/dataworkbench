"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnDiff, RiskLevel, SchemaDiffType } from "@/types/parquet";

type FilterOption = "all" | "differences" | "added" | "removed" | "changed" | "identical";

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All Columns" },
  { value: "differences", label: "Differences Only" },
  { value: "added", label: "Added" },
  { value: "removed", label: "Removed" },
  { value: "changed", label: "Changed" },
  { value: "identical", label: "Identical" },
];

const CHANGED_TYPES: SchemaDiffType[] = [
  "renamed",
  "type_changed",
  "nullability_changed",
  "metadata_changed",
  "reordered",
];

const RISK_STYLES: Record<RiskLevel, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  none: "bg-muted text-muted-foreground",
};

const DIFF_LABELS: Record<SchemaDiffType, string> = {
  added: "Added",
  removed: "Removed",
  renamed: "Renamed",
  type_changed: "Type changed",
  nullability_changed: "Nullability changed",
  metadata_changed: "Metadata changed",
  reordered: "Reordered",
  identical: "Identical",
};

const PAGE_SIZE = 50;

/** Side-by-side column diff workspace: search + filter + pagination keep
 * this fast and usable even with hundreds of columns. */
export function ColumnDiffTable({ columns }: { columns: ColumnDiff[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterOption>("differences");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = columns;

    switch (filter) {
      case "differences":
        result = result.filter((c) => c.diff_type !== "identical");
        break;
      case "added":
        result = result.filter((c) => c.diff_type === "added");
        break;
      case "removed":
        result = result.filter((c) => c.diff_type === "removed");
        break;
      case "changed":
        result = result.filter((c) => CHANGED_TYPES.includes(c.diff_type));
        break;
      case "identical":
        result = result.filter((c) => c.diff_type === "identical");
        break;
      default:
        break;
    }

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (c) =>
          c.column_name.toLowerCase().includes(query) ||
          (c.name_a ?? "").toLowerCase().includes(query) ||
          (c.name_b ?? "").toLowerCase().includes(query) ||
          (c.data_type_a ?? "").toLowerCase().includes(query) ||
          (c.data_type_b ?? "").toLowerCase().includes(query)
      );
    }

    return result;
  }, [columns, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Column Differences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search column name or data type..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFilter(option.value);
                  setPage(0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {pageItems.length === 0 ? (
          <EmptyState title="No matching columns" description="Try a different search term or filter." />
        ) : (
          <>
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Column</th>
                    <th className="px-4 py-2 font-medium">Change</th>
                    <th className="px-4 py-2 font-medium">Risk</th>
                    <th className="px-4 py-2 font-medium">File A</th>
                    <th className="px-4 py-2 font-medium">File B</th>
                    <th className="px-4 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((col) => (
                    <tr
                      key={`${col.name_a ?? ""}:${col.name_b ?? ""}`}
                      className={`border-t border-border ${col.diff_type !== "identical" ? "bg-muted/20" : ""}`}
                    >
                      <td className="px-4 py-2 font-mono">
                        {col.diff_type === "renamed" ? (
                          <span>
                            {col.name_a} <span className="text-muted-foreground">&rarr;</span> {col.name_b}
                          </span>
                        ) : (
                          col.column_name
                        )}
                      </td>
                      <td className="px-4 py-2">{DIFF_LABELS[col.diff_type]}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLES[col.risk_level]}`}>
                          {col.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {col.data_type_a ? `${col.data_type_a}${col.nullable_a ? "" : " (required)"}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {col.data_type_b ? `${col.data_type_b}${col.nullable_b ? "" : " (required)"}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{(col.details ?? []).join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
