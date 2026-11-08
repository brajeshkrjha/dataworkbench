"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnSchema, ParquetSample } from "@/types/parquet";

/** Sampling tab: first-N or random sample, bounded sample size — never
 * pulls the full dataset even for random mode (server picks one row group). */
export function SamplingTab({
  columns,
  sample,
  isLoading,
  onLoadSample,
}: {
  columns: ColumnSchema[];
  sample: ParquetSample | null;
  isLoading: boolean;
  onLoadSample: (mode: "first" | "random", size: number) => void;
}) {
  const [mode, setMode] = useState<"first" | "random">("first");
  const [size, setSize] = useState(50);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Row Sample</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("first")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "first" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              First rows
            </button>
            <button
              type="button"
              onClick={() => setMode("random")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "random" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Random sample
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={5000}
            value={size}
            onChange={(event) => setSize(Number(event.target.value) || 1)}
            className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
          />
          <Button size="sm" onClick={() => onLoadSample(mode, size)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Sampling..." : "Get sample"}
          </Button>
        </div>

        {!sample ? (
          <EmptyState title="No sample yet" description="Choose a mode and size, then click Get sample." />
        ) : sample.rows.length === 0 ? (
          <EmptyState title="No rows" description="This file has no rows to sample." />
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((col) => (
                    <th key={col.name} className="whitespace-nowrap px-4 py-2 font-medium">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.rows.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {columns.map((col) => (
                      <td key={col.name} className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                        {formatCell(row[col.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
