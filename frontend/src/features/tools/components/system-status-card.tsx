"use client";

import { Activity, RefreshCw } from "lucide-react";

import { useSystemStatus } from "@/features/tools/hooks/use-system-status";
import { cn } from "@/lib/utils";

/** Live platform status from the backend health/version endpoints, plus
 * a pointer to the global search shortcut. */
export function SystemStatusCard() {
  const { status, refresh } = useSystemStatus();

  const dot =
    status.state === "online" ? "bg-emerald-500" : status.state === "offline" ? "bg-red-500" : "bg-amber-400 animate-pulse";
  const label = status.state === "online" ? "All systems operational" : status.state === "offline" ? "Backend unreachable" : "Checking...";

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Platform status</h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh status"
          title="Refresh status"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", status.state === "loading" && "animate-spin")} />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          {label}
        </p>

        {status.state === "online" ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-right font-medium tabular-nums">{status.version.version}</dd>
            <dt className="text-muted-foreground">API</dt>
            <dd className="text-right font-medium">{status.version.api_version}</dd>
            <dt className="text-muted-foreground">Service</dt>
            <dd className="text-right font-medium">{status.health.status}</dd>
          </dl>
        ) : null}

        {status.state === "offline" ? <p className="text-xs text-muted-foreground">{status.message}</p> : null}
      </div>

      <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
        Tip: press{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">/</kbd>{" "}
        anywhere to search tools and modules.
      </div>
    </section>
  );
}
