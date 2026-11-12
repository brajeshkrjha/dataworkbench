/**
 * Pure, client-side text helpers behind the Compare Lists and Clean Up Text
 * modules. Nothing here touches the network.
 */

export interface ListOptions {
  ignoreCase: boolean;
  trim: boolean;
}

export interface ListComparison {
  onlyInA: string[];
  onlyInB: string[];
  inBoth: string[];
  totalA: number;
  totalB: number;
}

export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

function toItems(text: string, options: ListOptions): string[] {
  return splitLines(text)
    .map((line) => (options.trim ? line.trim() : line))
    .filter((line) => line !== "");
}

/** Set comparison of two line-separated lists. Duplicates collapse; the first
 * spelling seen is kept for display when ignoring case. */
export function compareLists(textA: string, textB: string, options: ListOptions): ListComparison {
  const key = (value: string) => (options.ignoreCase ? value.toLowerCase() : value);
  const itemsA = toItems(textA, options);
  const itemsB = toItems(textB, options);

  const mapA = new Map<string, string>();
  for (const item of itemsA) if (!mapA.has(key(item))) mapA.set(key(item), item);
  const mapB = new Map<string, string>();
  for (const item of itemsB) if (!mapB.has(key(item))) mapB.set(key(item), item);

  const onlyInA: string[] = [];
  const inBoth: string[] = [];
  for (const [k, value] of mapA) (mapB.has(k) ? inBoth : onlyInA).push(value);
  const onlyInB = [...mapB].filter(([k]) => !mapA.has(k)).map(([, value]) => value);

  return { onlyInA, onlyInB, inBoth, totalA: mapA.size, totalB: mapB.size };
}

export type SortOrder = "none" | "asc" | "desc";
export type CaseMode = "none" | "lower" | "upper";

export interface CleanupOptions {
  trimLines: boolean;
  collapseSpaces: boolean;
  removeEmpty: boolean;
  removeDuplicates: boolean;
  sort: SortOrder;
  caseMode: CaseMode;
}

export interface CleanupResult {
  output: string;
  linesBefore: number;
  linesAfter: number;
}

export const DEFAULT_CLEANUP: CleanupOptions = {
  trimLines: true,
  collapseSpaces: false,
  removeEmpty: true,
  removeDuplicates: false,
  sort: "none",
  caseMode: "none",
};

export function cleanupText(text: string, options: CleanupOptions): CleanupResult {
  let lines = text === "" ? [] : splitLines(text);
  const linesBefore = lines.length;

  if (options.trimLines) lines = lines.map((line) => line.trim());
  if (options.collapseSpaces) lines = lines.map((line) => line.replace(/[ \t]+/g, " "));
  if (options.caseMode === "lower") lines = lines.map((line) => line.toLowerCase());
  if (options.caseMode === "upper") lines = lines.map((line) => line.toUpperCase());
  if (options.removeEmpty) lines = lines.filter((line) => line.trim() !== "");
  if (options.removeDuplicates) lines = [...new Set(lines)];
  if (options.sort !== "none") {
    const sorted = [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    lines = options.sort === "asc" ? sorted : sorted.reverse();
  }

  return { output: lines.join("\n"), linesBefore, linesAfter: lines.length };
}
