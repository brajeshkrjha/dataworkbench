/**
 * Service layer for health/version endpoints.
 */
import { apiGet } from "@/services/api-client";
import type { HealthResponse, VersionResponse } from "@/types/api";

export const systemService = {
  getHealth(): Promise<HealthResponse> {
    return apiGet<HealthResponse>("/health");
  },

  getVersion(): Promise<VersionResponse> {
    return apiGet<VersionResponse>("/version");
  },
};
