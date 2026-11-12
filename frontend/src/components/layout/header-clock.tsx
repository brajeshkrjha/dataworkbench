"use client";

import { useEffect, useMemo, useState } from "react";

import { useTimeZoneStore } from "@/store/use-time-zone-store";

/** Compact live date, day, and time for the header. Renders after mount to avoid hydration mismatch. */
export function HeaderClock() {
  const timeZone = useTimeZoneStore((state) => state.timeZone);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const formats = useMemo(() => {
    const tz = timeZone === "local" ? undefined : timeZone;
    return {
      date: new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
      time: new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
      zone: new Intl.DateTimeFormat("en-IN", { timeZoneName: "short", timeZone: tz }),
    };
  }, [timeZone]);

  if (!now) return <div aria-hidden className="hidden h-9 w-36 md:block" />;

  const zoneName = formats.zone.formatToParts(now).find((part) => part.type === "timeZoneName")?.value;

  return (
    <time
      dateTime={now.toISOString()}
      title={zoneName ? `Time zone: ${zoneName} (change in Settings)` : undefined}
      className="hidden items-center gap-2 text-xs text-muted-foreground tabular-nums md:flex"
    >
      <span>{formats.date.format(now)}</span>
      <span aria-hidden className="h-3 w-px bg-border" />
      <span className="font-medium text-foreground">{formats.time.format(now)}</span>
      {zoneName ? <span className="text-[10px]">{zoneName}</span> : null}
    </time>
  );
}
