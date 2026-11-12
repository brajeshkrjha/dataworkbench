"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { SearchResultsList } from "@/features/search/components/search-results-list";
import { useSearchController } from "@/features/search/use-search-controller";

/** Large inline search box for the Home page hero, with live type-ahead results. */
export function SearchBar() {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results, activeIndex, setActiveIndex, select, handleKeyDown } =
    useSearchController();

  // Global "/" shortcut to jump into search, matching the muscle memory
  // of GitHub/Linear/Slack — makes search feel like a first-class tool,
  // not a page decoration.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showResults = isFocused && query.trim().length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="flex h-12 items-center gap-3 rounded-xl border border-border/80 bg-card px-4 shadow-md transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder="Search tools, modules, and capabilities..."
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none"
        />
        {!isFocused && !query ? (
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block">
            /
          </kbd>
        ) : null}
      </div>
      {showResults ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {results.length > 0 ? (
            <SearchResultsList
              results={results}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              onSelect={select}
            />
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &quot;{query}&quot;.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
