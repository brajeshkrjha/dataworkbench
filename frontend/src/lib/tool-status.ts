import type { ToolStatus } from "@/types/tool";

/**
 * Single source of truth for "is this tool clickable/interactive".
 * Mirrors backend `is_tool_interactive` in schemas/tools.py.
 */
export function isToolInteractive(status: ToolStatus): boolean {
  return status === "available" || status === "beta";
}
