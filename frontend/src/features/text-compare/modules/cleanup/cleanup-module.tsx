"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/features/text-compare/components/copy-button";
import {
  cleanupText,
  DEFAULT_CLEANUP,
  type CaseMode,
  type CleanupOptions,
  type SortOrder,
} from "@/features/text-compare/lib/text-tools";

const AREA =
  "min-h-[260px] w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring";

const CHECKBOXES: Array<{ key: "trimLines" | "collapseSpaces" | "removeEmpty" | "removeDuplicates"; label: string }> = [
  { key: "trimLines", label: "Trim each line" },
  { key: "collapseSpaces", label: "Collapse repeated spaces" },
  { key: "removeEmpty", label: "Remove empty lines" },
  { key: "removeDuplicates", label: "Remove duplicate lines" },
];

const SELECT =
  "rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Line-based text normalization: trim, dedupe, sort, change case. */
export function CleanupModule() {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<CleanupOptions>(DEFAULT_CLEANUP);

  const result = useMemo(() => cleanupText(input, options), [input, options]);
  const removed = result.linesBefore - result.linesAfter;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 text-sm">
          {CHECKBOXES.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={options[item.key]}
                onChange={(e) => setOptions((previous) => ({ ...previous, [item.key]: e.target.checked }))}
              />
              {item.label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            Sort
            <select
              className={SELECT}
              value={options.sort}
              onChange={(e) => setOptions((previous) => ({ ...previous, sort: e.target.value as SortOrder }))}
            >
              <option value="none">Keep order</option>
              <option value="asc">A to Z</option>
              <option value="desc">Z to A</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Case
            <select
              className={SELECT}
              value={options.caseMode}
              onChange={(e) => setOptions((previous) => ({ ...previous, caseMode: e.target.value as CaseMode }))}
            >
              <option value="none">Keep</option>
              <option value="lower">lowercase</option>
              <option value="upper">UPPERCASE</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Input</p>
          <textarea
            className={AREA}
            placeholder="Paste text here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Result</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {result.linesBefore.toLocaleString()} to {result.linesAfter.toLocaleString()} lines
              {removed > 0 ? ` (${removed.toLocaleString()} removed)` : ""}
            </p>
          </div>
          <textarea className={`${AREA} bg-muted/30`} readOnly value={result.output} placeholder="Cleaned text appears here..." />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton text={result.output} label="Copy result" />
        <Button variant="outline" size="sm" disabled={result.output === ""} onClick={() => setInput(result.output)}>
          Use result as input
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={input === ""}
          onClick={() => {
            setInput("");
            setOptions(DEFAULT_CLEANUP);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
