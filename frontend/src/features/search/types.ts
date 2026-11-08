/**
 * Global search types.
 *
 * `kind` is deliberately open-ended (string, not a closed union) so future
 * result kinds — docs, metadata, capabilities — can be added by a new
 * index provider without changing consumers of `SearchResultItem`.
 */
export type SearchResultKind = "tool" | "feature" | "category";

export interface SearchResultItem {
  /** Stable, globally unique id (e.g. "tool:parquet-utility"). */
  id: string;
  kind: SearchResultKind;
  title: string;
  description: string;
  href: string;
  icon: string;
  /** Extra terms matched against but not necessarily displayed. */
  keywords: string[];
  /** Optional parent context, e.g. the owning tool's name for a feature. */
  context?: string;
}
