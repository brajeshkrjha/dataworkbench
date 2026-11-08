/**
 * Category → nav/route registry for static, non-tool-specific navigation.
 * The list of tools themselves comes from the backend Tool Registry
 * (see services/tool-service.ts), not from this file.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: "Home" },
  { label: "Tools", href: "/tools", icon: "LayoutGrid" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];
