"use client";

import { useEffect, useRef, useState } from "react";

import { systemService } from "@/services/system-service";

/** Only show the loader if the server hasn't answered by then (avoids a flash when warm). */
const SHOW_DELAY_MS = 700;
const RETRY_DELAY_MS = 2000;
const TICK_MS = 120;
/** Simulated progress never passes this until the server really responds. */
const PROGRESS_CEILING = 95;
/** Re-check the server when the tab becomes visible after being hidden this long. */
const RECHECK_AFTER_MS = 5 * 60 * 1000;
const FINISH_HOLD_MS = 450;

type Phase = "idle" | "loading" | "done";

function stageMessage(percent: number, attempts: number): string {
  if (attempts > 3) return "Still waking up the server. Thanks for your patience.";
  if (percent < 30) return "Starting the server...";
  if (percent < 65) return "Loading tools and libraries...";
  if (percent < 95) return "Almost ready...";
  return "Finishing up...";
}

/**
 * Full-screen loader shown while the backend is starting or restarting (e.g. a
 * serverless cold start). The server can't report real startup progress, so the
 * percentage is simulated: it eases toward 95% and jumps to 100% when /health
 * actually responds.
 */
export function ServerStatusLoader() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const lastOkRef = useRef(0);
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let ticker: ReturnType<typeof setInterval> | null = null;

    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    const stopTicker = () => {
      if (ticker) clearInterval(ticker);
      ticker = null;
    };

    const check = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      let ready = false;
      let failures = 0;
      later(() => {
        if (cancelled || ready) return;
        setPercent(0);
        setAttempts(0);
        setPhase("loading");
        ticker = setInterval(() => {
          setPercent((current) => current + (PROGRESS_CEILING - current) * 0.04);
        }, TICK_MS);
      }, SHOW_DELAY_MS);

      while (!cancelled && !ready) {
        try {
          await systemService.getHealth();
          ready = true;
        } catch {
          failures += 1;
          if (!cancelled) setAttempts(failures);
          await new Promise<void>((resolve) => later(resolve, RETRY_DELAY_MS));
        }
      }

      checkingRef.current = false;
      if (cancelled) return;

      lastOkRef.current = Date.now();
      stopTicker();
      setPercent((current) => {
        // Only animate the finish if the loader was actually visible.
        return current > 0 ? 100 : current;
      });
      later(() => setPhase("done"), FINISH_HOLD_MS);
      later(() => setPhase("idle"), FINISH_HOLD_MS + 300);
    };

    void check();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastOkRef.current < RECHECK_AFTER_MS) return;
      void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      checkingRef.current = false;
      stopTicker();
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (phase === "idle") return null;

  const rounded = Math.min(100, Math.floor(percent));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Server loading, ${rounded} percent`}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300 ${
        phase === "done" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="w-[min(92vw,26rem)] rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <h2 className="text-base font-semibold text-foreground">Getting the server ready</h2>
        <p className="mt-1 text-sm text-muted-foreground">{stageMessage(percent, attempts)}</p>

        <div
          className="mt-5 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
            style={{ width: `${rounded}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium tabular-nums text-foreground">{rounded}%</p>
        <p className="mt-3 text-xs text-muted-foreground">
          The server sleeps when idle, so the first load can take 10-15 seconds.
        </p>
      </div>
    </div>
  );
}
