import { resolveToolIcon } from "@/ui-registry/icon-registry";

/**
 * Renders a Tool Registry icon by name. Kept as its own component (rather
 * than resolving to a component reference inline) to satisfy the
 * react-hooks/static-components rule and avoid recreating components
 * during render.
 */
export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = resolveToolIcon(name);
  // eslint-disable-next-line react-hooks/static-components -- icon is resolved from a fixed registry map, not created dynamically.
  return <Icon className={className} />;
}
