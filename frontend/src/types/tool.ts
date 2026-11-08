/**
 * Types describing tools in the Tool Registry.
 *
 * Derived from the backend's OpenAPI schema (generated via
 * `npm run generate:api-types`) so the frontend contract can never
 * silently drift from `backend/app/schemas/tools.py`.
 */
import type { components } from "@/types/generated/api";

export type ToolCategory = components["schemas"]["ToolCategory"];
export type ToolStatus = components["schemas"]["ToolStatus"];
export type ToolMetadata = components["schemas"]["ToolMetadata"];
export type ToolListResponse = components["schemas"]["ToolListResponse"];
