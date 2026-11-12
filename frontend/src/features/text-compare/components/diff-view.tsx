"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DiffType, LineDiff } from "@/types/text-compare";

type FilterOption = "all" | "differences" | DiffType;

const FILTERS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "differences", label: "Differences Only" },
  { value: "added", label: "Added" },
  { value: "removed", label: "Removed" },
  { value: "modified", label: "Modified" },
  { value: "identical", label: "Identical" },
];

/** GitHub-style per-side cell background + gutter marker, keyed by diff
 * type and which side ("a" = left/old, "b" = right/new). Mirrors GitHub's
 * split diff view: deletions tint red on the old side, additions tint
 * green on the new side; a modified line shows both. */
const CELL_STYLES: Record<DiffType, { a: string; b: string; markerA: string; markerB: string }> = {
  added: {
    a: "",
    b: "bg-[#e6ffec] dark:bg-[#2ea04326]",
    markerA: "",
    markerB: "text-[#1a7f37] dark:text-[#3fb950]",
  },
  removed: {
    a: "bg-[#ffebe9] dark:bg-[#f8514926]",
    b: "",
    markerA: "text-[#cf222e] dark:text-[#f85149]",
    markerB: "",
  },
  modified: {
    a: "bg-[#ffebe9] dark:bg-[#f8514926]",
    b: "bg-[#e6ffec] dark:bg-[#2ea04326]",
    markerA: "text-[#cf222e] dark:text-[#f85149]",
    markerB: "text-[#1a7f37] dark:text-[#3fb950]",
  },
  identical: { a: "", b: "", markerA: "", markerB: "" },
};

const MARKER: Record<DiffType, { a: string; b: string }> = {
  added: { a: "", b: "+" },
  removed: { a: "-", b: "" },
  modified: { a: "-", b: "+" },
  identical: { a: "", b: "" },
};

/** Makes space/tab characters visible so whitespace-only changes can be seen. */
function showWhitespace(value: string): string {
  return value.replace(/ /g, "\u00b7").replace(/\t/g, "\u2192");
}

/** Renders a line; for modified lines the differing segment is highlighted and
 * its whitespace made visible (e.g. a trailing space shows as a dot). */
function LineContent({ own, other, highlight }: { own: string; other: string; highlight: boolean }) {
  if (!highlight || own === other) return <>{own}</>;
  let start = 0;
  const max = Math.min(own.length, other.length);
  while (start < max && own[start] === other[start]) start++;
  let end = 0;
  while (end < max - start && own[own.length - 1 - end] === other[other.length - 1 - end]) end++;
  const middle = own.slice(start, own.length - end);
  return (
    <>
      {own.slice(0, start)}
      <mark className="rounded-sm bg-yellow-300/70 px-px text-inherit dark:bg-yellow-500/40">
        {showWhitespace(middle)}
      </mark>
      {own.slice(own.length - end)}
    </>
  );
}

/** Side-by-side, synchronized-scroll line diff with search and filter
 * chips - the baseline view, always available regardless of type. */
export function DiffView({ lines, labelA, labelB }: { lines: LineDiff[]; labelA: string; labelB: string }) {
  const [filter, setFilter] = useState<FilterOption>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return lines.filter((line) => {
      if (filter === "differences" && line.diff_type === "identical") return false;
      if (filter !== "all" && filter !== "differences" && line.diff_type !== filter) return false;
      if (normalizedQuery) {
        const haystack = `${line.content_a ?? ""} ${line.content_b ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [lines, filter, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lines..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{labelA}</Badge>
        <span>vs</span>
        <Badge variant="outline">{labelB}</Badge>
        <span className="ml-auto">{visible.length} of {lines.length} lines</span>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {visible.map((line, index) => {
              const cell = CELL_STYLES[line.diff_type];
              const marker = MARKER[line.diff_type];
              return (
                <tr key={index}>
                  <td
                    className={`w-10 select-none border-r border-border/50 px-2 py-1 text-right text-muted-foreground ${cell.a}`}
                  >
                    {line.line_number_a ?? ""}
                  </td>
                  <td className={`w-5 select-none border-r border-border/50 px-1.5 py-1 text-center font-semibold ${cell.a} ${cell.markerA}`}>
                    {marker.a}
                  </td>
                  <td className={`w-1/2 whitespace-pre-wrap break-all border-r border-border/50 px-2 py-1 ${cell.a}`}>
                    <LineContent
                      own={line.content_a ?? ""}
                      other={line.content_b ?? ""}
                      highlight={line.diff_type === "modified"}
                    />
                  </td>
                  <td
                    className={`w-10 select-none border-r border-border/50 px-2 py-1 text-right text-muted-foreground ${cell.b}`}
                  >
                    {line.line_number_b ?? ""}
                  </td>
                  <td className={`w-5 select-none border-r border-border/50 px-1.5 py-1 text-center font-semibold ${cell.b} ${cell.markerB}`}>
                    {marker.b}
                  </td>
                  <td className={`w-1/2 whitespace-pre-wrap break-all px-2 py-1 ${cell.b}`}>
                    <LineContent
                      own={line.content_b ?? ""}
                      other={line.content_a ?? ""}
                      highlight={line.diff_type === "modified"}
                    />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                  No lines match the current filter/search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
