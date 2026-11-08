import type { SearchResultItem } from "@/features/search/types";

/**
 * Ranks and filters the search index against a free-text query.
 *
 * Every whitespace-separated token in the query must match somewhere in
 * the item (title, context, keywords, or description) for the item to be
 * included at all; matches earlier in that list score higher, and exact
 * or prefix title matches score highest of all. This is intentionally a
 * small, swappable pure function — a future fuzzy/backend-powered search
 * can replace it without touching any UI code.
 */
export function searchItems(
  items: SearchResultItem[],
  query: string,
  limit = 8
): SearchResultItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  return items
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function scoreItem(item: SearchResultItem, tokens: string[]): number {
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();
  const context = item.context?.toLowerCase() ?? "";
  const keywords = item.keywords.join(" ").toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (title === token) score += 10;
    else if (title.startsWith(token)) score += 6;
    else if (title.includes(token)) score += 4;
    else if (context.includes(token)) score += 3;
    else if (keywords.includes(token)) score += 2;
    else if (description.includes(token)) score += 1;
    else return 0;
  }
  return score;
}
