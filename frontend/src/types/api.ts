/**
 * Health/version types derived from the backend's OpenAPI schema.
 * `ApiErrorResponse` has no backend schema counterpart yet, so it
 * remains hand-written until one exists.
 */
import type { components } from "@/types/generated/api";

export type HealthResponse = components["schemas"]["HealthResponse"];
export type VersionResponse = components["schemas"]["VersionResponse"];

export interface ApiErrorResponse {
  error: string;
  message: string;
}
