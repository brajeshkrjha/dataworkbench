/**
 * Settings Registry: the single place where settings are declared.
 *
 * Adding a setting = adding one item to a section (or a new section). The
 * page layout, section navigation, and search pick it up automatically.
 */
import type { ComponentType } from "react";
import { Database, Info, Palette, type LucideIcon } from "lucide-react";

import {
  AboutValue,
  ClearFavoritesControl,
  ClearRecentsControl,
  ThemeControl,
} from "@/features/settings/components/setting-controls";

export interface SettingItem {
  id: string;
  title: string;
  description?: string;
  /** Extra search terms that are not in the title/description. */
  keywords?: string[];
  Control: ComponentType;
}

export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: SettingItem[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "appearance",
    title: "Appearance",
    description: "How DataWorkbench looks on this device.",
    icon: Palette,
    items: [
      {
        id: "theme",
        title: "Theme",
        description: "Switch between light and dark mode.",
        keywords: ["dark", "light", "mode", "color"],
        Control: ThemeControl,
      },
    ],
  },
  {
    id: "data",
    title: "Workspace data",
    description: "Stored only in this browser. Nothing here is sent to a server.",
    icon: Database,
    items: [
      {
        id: "favorites",
        title: "Favorite tools",
        description: "Tools you starred for quick access.",
        keywords: ["star", "pinned", "reset", "clear"],
        Control: ClearFavoritesControl,
      },
      {
        id: "recents",
        title: "Recently opened",
        description: "History of tools you opened lately.",
        keywords: ["history", "reset", "clear"],
        Control: ClearRecentsControl,
      },
    ],
  },
  {
    id: "about",
    title: "About",
    description: "Application and backend build information.",
    icon: Info,
    items: [
      { id: "application", title: "Application", Control: () => <AboutValue field="application" /> },
      { id: "backend", title: "Backend status", keywords: ["online", "api", "server"], Control: () => <AboutValue field="backend" /> },
      { id: "version", title: "Version", keywords: ["build", "release"], Control: () => <AboutValue field="version" /> },
      { id: "api-version", title: "API version", Control: () => <AboutValue field="api" /> },
    ],
  },
];

/** Sections filtered by a search query; empty sections are dropped. */
export function filterSettings(query: string): SettingsSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return SETTINGS_SECTIONS;

  return SETTINGS_SECTIONS.map((section) => {
    const sectionMatches = `${section.title} ${section.description}`.toLowerCase().includes(q);
    const items = sectionMatches
      ? section.items
      : section.items.filter((item) =>
          [item.title, item.description ?? "", ...(item.keywords ?? [])].join(" ").toLowerCase().includes(q)
        );
    return { ...section, items };
  }).filter((section) => section.items.length > 0);
}
