"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnSchema } from "@/types/parquet";
import { ROW_LIMIT_OPTIONS, type RowLimit } from "@/features/parquet/modules/reader/constants";

type SortDirection = "asc" | "desc";

function cellToDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Data Grid for the currently loaded page of rows. Sorting and the search
 * box operate only on the loaded page (client-side) — full-dataset
 * filtering is out of scope for Phase 1. Server-side pagination (offset/
 * limit) is what keeps this from ever loading the whole file.
 */
export function DataGrid({
  columns,
  rows,
  offset,
  limit,
  totalRowCount,
  isLoadingRows,
  onPageChange,
  onLimitChange,
}: {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  offset: number;
  limit: RowLimit;
  totalRowCount: number;
  isLoadingRows: boolean;
  onPageChange: (offset: number) => void;
  onLimitChange: (limit: RowLimit) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const visibleRows = useMemo(() => {
    let result = rows;

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((row) =>
        columns.some((column) => cellToDisplayString(row[column.name]).toLowerCase().includes(query))
      );
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const left = a[sortColumn];
        const right = b[sortColumn];
        if (left === right) return 0;
        if (left === null || left === undefined) return 1;
        if (right === null || right === undefined) return -1;
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [rows, search, columns, sortColumn, sortDirection]);

  const toggleSort = (columnName: string) => {
    if (sortColumn !== columnName) {
      setSortColumn(columnName);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortColumn(null);
  };

  const pageStart = totalRowCount === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, totalRowCount);
  const canGoPrevious = offset > 0;
  const canGoNext = offset + limit < totalRowCount;

  return (
    <div aria-busy={isLoadingRows} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Search displayed rows"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search displayed rows..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page:</span>
          {ROW_LIMIT_OPTIONS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={limit === option ? "secondary" : "ghost"}
              disabled={isLoadingRows}
              onClick={() => onLimitChange(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No rows" description="This file has no row data to display." />
      ) : (
        <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((column) => {
                  const isActive = sortColumn === column.name;
                  return (
                    <th
                      key={column.name}
                      scope="col"
                      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      className="resize-x overflow-hidden border-b border-border px-4 py-2 font-medium"
                      style={{ minWidth: 120, maxWidth: 480 }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.name)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {column.name}
                        {isActive ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <tr key={offset + index} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  {columns.map((column) => (
                    <td key={column.name} className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {cellToDisplayString(row[column.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalRowCount === 0
            ? "0 rows"
            : `Showing ${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${totalRowCount.toLocaleString()} rows`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canGoPrevious || isLoadingRows}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canGoNext || isLoadingRows}
            onClick={() => onPageChange(offset + limit)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
