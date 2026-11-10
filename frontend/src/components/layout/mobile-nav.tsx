"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";

import { NAV_ICONS } from "@/components/layout/nav-icons";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV } from "@/ui-registry/nav-registry";

/**
 * Hamburger + slide-in drawer, visible only below the `md` breakpoint where
 * the desktop sidebar is hidden. Closes on link tap, backdrop tap, or Escape,
 * and locks body scroll while open.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted
        ? createPortal(
            <div className="md:hidden">
      <div
        aria-hidden
        onClick={() => setIsOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!isOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-background shadow-xl transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-gradient-brand text-base font-semibold tracking-tight">
            {siteConfig.name}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {PRIMARY_NAV.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
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
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {siteConfig.tagline}
        </p>
      </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
