/**
 * Service layer for the Tool Registry API. All tool-related network
 * access should go through this module.
 */
import { apiGet } from "@/services/api-client";
import type { ToolListResponse, ToolMetadata } from "@/types/tool";

export const toolService = {
  listTools(): Promise<ToolListResponse> {
    return apiGet<ToolListResponse>("/tools");
  },

  getTool(toolId: string): Promise<ToolMetadata> {
    return apiGet<ToolMetadata>(`/tools/${encodeURIComponent(toolId)}`);
  },
};
