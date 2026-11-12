"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/features/text-compare/components/copy-button";
import { compareLists } from "@/features/text-compare/lib/text-tools";

const AREA =
  "min-h-[180px] w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring";

function ResultColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{items.length.toLocaleString()} items</p>
          </div>
          <CopyButton text={items.join("\n")} />
        </div>
        <pre className="max-h-72 min-h-[96px] overflow-auto rounded-lg border border-border/70 bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-all">
          {items.length > 0 ? items.join("\n") : "-"}
        </pre>
      </CardContent>
    </Card>
  );
}

/** Set comparison of two line-separated lists (IDs, column names, ...). */
export function ListsModule() {
  const [textA, setTextA] = useState("");
  const [textB, setTextB] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [trim, setTrim] = useState(true);

  const result = useMemo(() => compareLists(textA, textB, { ignoreCase, trim }), [textA, textB, ignoreCase, trim]);
  const hasInput = textA.trim() !== "" || textB.trim() !== "";

  const stats = [
    { label: "Only in A", value: result.onlyInA.length },
    { label: "Only in B", value: result.onlyInB.length },
    { label: "In both", value: result.inBoth.length },
    { label: "Unique in A", value: result.totalA },
    { label: "Unique in B", value: result.totalB },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">List A</p>
          <textarea className={AREA} placeholder="One item per line..." value={textA} onChange={(e) => setTextA(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">List B</p>
          <textarea className={AREA} placeholder="One item per line..." value={textB} onChange={(e) => setTextB(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.target.checked)} />
              Ignore case
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
              Trim spaces
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={textA === "" && textB === ""}
              onClick={() => {
                setTextA(textB);
                setTextB(textA);
              }}
            >
              Swap A and B
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasInput}
              onClick={() => {
                setTextA("");
                setTextB("");
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ResultColumn title="Only in A" items={result.onlyInA} />
            <ResultColumn title="Only in B" items={result.onlyInB} />
            <ResultColumn title="In both" items={result.inBoth} />
          </div>
        </>
      ) : null}
    </div>
  );
}
