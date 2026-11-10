"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

const KEYWORD_REGEX =
  /\b(view|explore|dimension|dimension_group|measure|join|set|label|description|sql|type|hidden|primary_key|value_format_name|drill_fields|relationship|sql_on|group_label)\b(?=\s*:)/g;

function highlightLine(line: string, query: string): ReactNode {
  const withKeywords = line.split(KEYWORD_REGEX);
  const isKeyword = (segment: string) => KEYWORD_REGEX.test(`${segment}:`);
  KEYWORD_REGEX.lastIndex = 0;

  const nodes: ReactNode[] = withKeywords.map((segment, index) => {
    if (isKeyword(segment)) {
      return (
        <span key={index} className="text-sky-600 dark:text-sky-400 font-medium">
          {segment}
        </span>
      );
    }
    return <span key={index}>{segment}</span>;
  });

  if (!query) return nodes;

  // Wrap the plain-text render in a highlighter pass for the search query.
  const plain = line;
  const lowerPlain = plain.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (!lowerPlain.includes(lowerQuery)) return nodes;

  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerPlain.indexOf(lowerQuery, cursor);
  let key = 0;
  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(<span key={key++}>{plain.slice(cursor, matchIndex)}</span>);
    parts.push(
      <mark key={key++} className="rounded bg-yellow-300/70 px-0.5 text-inherit dark:bg-yellow-500/40">
        {plain.slice(matchIndex, matchIndex + query.length)}
      </mark>
    );
    cursor = matchIndex + query.length;
    matchIndex = lowerPlain.indexOf(lowerQuery, cursor);
  }
  if (cursor < plain.length) parts.push(<span key={key++}>{plain.slice(cursor)}</span>);
  return parts;
}

export function CodeViewer({
  code,
  fileName,
  className,
}: {
  code: string;
  fileName?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const lines = useMemo(() => code.split("\n"), [code]);

  const matchCount = useMemo(() => {
    if (!query) return 0;
    const lowerQuery = query.toLowerCase();
    return lines.reduce((count, line) => count + (line.toLowerCase().includes(lowerQuery) ? 1 : 0), 0);
  }, [lines, query]);

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lg border border-border", className)}>
      <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="truncate font-mono text-xs text-muted-foreground">{fileName ?? "untitled.lkml"}</p>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in file"
              className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-base outline-none focus:ring-1 focus:ring-primary sm:h-7 sm:w-40 sm:text-xs"
            />
          </div>
          {query ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          ) : null}
        </div>
      </div>
      <pre className="max-h-[60dvh] overflow-auto bg-card p-0 text-xs leading-5 sm:max-h-[32rem]">
        <code className="block">
          {lines.map((line, index) => (
            <div key={index} className="flex px-3 hover:bg-muted/30">
              <span className="mr-4 w-8 shrink-0 select-none text-right text-muted-foreground/60">
                {index + 1}
              </span>
              <span className="whitespace-pre-wrap break-all font-mono">
                {highlightLine(line, query)}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
