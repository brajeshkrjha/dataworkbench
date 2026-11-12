"use client";

/**
 * Live backend status (health + version) for the Home status card and the
 * Settings "About" card. Every value shown comes from the real API.
 */
import { useCallback, useEffect, useState } from "react";

import { systemService } from "@/services/system-service";
import type { HealthResponse, VersionResponse } from "@/types/api";

export type SystemStatus =
  | { state: "loading" }
  | { state: "online"; health: HealthResponse; version: VersionResponse }
  | { state: "offline"; message: string };

async function loadStatus(): Promise<SystemStatus> {
  try {
    const [health, version] = await Promise.all([systemService.getHealth(), systemService.getVersion()]);
    return { state: "online", health, version };
  } catch (err) {
    return { state: "offline", message: err instanceof Error ? err.message : "Backend unreachable." };
  }
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    setStatus({ state: "loading" });
    void loadStatus().then(setStatus);
  }, []);

  return { status, refresh };
}
