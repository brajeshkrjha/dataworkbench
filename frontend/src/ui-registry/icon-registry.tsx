/**
 * Icon Registry: maps backend-provided icon name strings (lucide-react
 * icon names, e.g. "Table", "FileCode") to actual components.
 *
 * Adding a new tool that uses a new icon only requires adding one entry
 * here — no changes needed elsewhere in the UI.
 */
import {
  ArrowLeftRight,
  BadgeCheck,
  Boxes,
  Braces,
  Cloud,
  Database,
  Diff,
  Eye,
  FileCode,
  FileCode2,
  FileOutput,
  FileSearch,
  FileTerminal,
  GitCompare,
  LayoutGrid,
  Microscope,
  ShieldCheck,
  Snowflake,
  Table,
  Tags,
  Telescope,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Table,
  FileOutput,
  FileSearch,
  Braces,
  FileCode,
  FileCode2,
  Boxes,
  Database,
  FileTerminal,
  ArrowLeftRight,
  GitCompare,
  Diff,
  ShieldCheck,
  Workflow,
  BadgeCheck,
  Tags,
  Snowflake,
  Cloud,
  Zap,
  LayoutGrid,
  Eye,
  Telescope,
  Microscope,
};

const DEFAULT_ICON: LucideIcon = Wrench;

/** Resolve an icon name to a component, falling back to a generic icon. */
export function resolveToolIcon(iconName: string): LucideIcon {
  return ICON_REGISTRY[iconName] ?? DEFAULT_ICON;
}
