"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { useTools } from "@/features/tools/hooks/use-tools";
import { getTotalModuleCount } from "@/features/tools/lib/module-count";
import { useSystemStatus } from "@/features/tools/hooks/use-system-status";
import { cn } from "@/lib/utils";
import { useFavoriteToolsStore } from "@/store/use-favorite-tools-store";
import { useRecentToolsStore } from "@/store/use-recent-tools-store";
import { useThemeStore, type Theme } from "@/store/use-theme-store";
import { TIME_ZONE_OPTIONS, useTimeZoneStore } from "@/store/use-time-zone-store";

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Segmented Light/Dark switch. */
export function ThemeControl() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => setTheme(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ClearFavoritesControl() {
  const count = useFavoriteToolsStore((state) => state.toolIds.length);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground tabular-nums">{count} saved</span>
      <Button variant="outline" size="sm" disabled={count === 0} onClick={() => useFavoriteToolsStore.setState({ toolIds: [] })}>
        Clear
      </Button>
    </div>
  );
}

export function ClearRecentsControl() {
  const count = useRecentToolsStore((state) => state.toolIds.length);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground tabular-nums">{count} saved</span>
      <Button variant="outline" size="sm" disabled={count === 0} onClick={() => useRecentToolsStore.setState({ toolIds: [] })}>
        Clear
      </Button>
    </div>
  );
}

type AboutField = "application" | "backend" | "version" | "api" | "tools" | "modules";

/** Read-only value pulled from the app config or live backend status. */
export function AboutValue({ field }: { field: AboutField }) {
  const { status } = useSystemStatus();
  const { tools } = useTools();
  const online = status.state === "online";

  let value = "-";
  if (field === "tools") value = String(tools.length);
  else if (field === "modules") value = String(getTotalModuleCount(tools.map((tool) => tool.id)));
  else if (field === "application") value = siteConfig.name;
  else if (field === "backend") value = online ? "Online" : status.state === "offline" ? "Unreachable" : "Checking...";
  else if (field === "version") value = online ? status.version.version : "-";
  else value = online ? status.version.api_version : "-";

  return <span className="text-sm font-medium tabular-nums">{value}</span>;
}

/** Time zone picker for the header clock. */
export function TimeZoneControl() {
  const timeZone = useTimeZoneStore((state) => state.timeZone);
  const setTimeZone = useTimeZoneStore((state) => state.setTimeZone);

  return (
    <select
      aria-label="Time zone"
      value={timeZone}
      onChange={(event) => setTimeZone(event.target.value)}
      className="h-9 max-w-[14rem] rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
    >
      {TIME_ZONE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
