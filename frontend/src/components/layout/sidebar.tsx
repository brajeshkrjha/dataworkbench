"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { NAV_ICONS } from "@/components/layout/nav-icons";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import { PRIMARY_NAV } from "@/ui-registry/nav-registry";

export function Sidebar() {
  const pathname = usePathname();
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);
  const toggle = useSidebarStore((state) => state.toggle);

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-border transition-[width] duration-200 ease-in-out md:flex md:flex-col",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border px-3",
          isCollapsed ? "justify-center" : "justify-end"
        )}
      >
        <button
          type="button"
          onClick={toggle}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {PRIMARY_NAV.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isCollapsed && "justify-center px-0",
                isActive
                  ? "bg-gradient-brand-soft text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-gradient-brand absolute inset-y-1.5 left-0 w-[3px] rounded-full"
                />
              ) : null}
              {Icon ? (
                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
              ) : null}
              {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
