"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { filterSettings, SETTINGS_SECTIONS } from "@/features/settings/registry/settings-registry";

/** Searchable settings: sticky section nav (desktop) + row-based section cards. */
export function SettingsView() {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => filterSettings(query), [query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings..."
          aria-label="Search settings"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-6 flex flex-col gap-1">
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const visible = sections.some((s) => s.id === section.id);
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/50 ${
                      visible ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {section.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {sections.length === 0 ? (
            <EmptyState title="No settings found" description="Try a different search term." />
          ) : (
            sections.map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.id} id={section.id} className="scroll-mt-6">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold tracking-tight">{section.title}</h2>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">{section.description}</p>
                  <ul className="divide-y divide-border/70 rounded-xl border border-border bg-card shadow-sm">
                    {section.items.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          ) : null}
                        </div>
                        <item.Control />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
