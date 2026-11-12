import Link from "next/link";

import { HeaderClock } from "@/components/layout/header-clock";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { siteConfig } from "@/config/site";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60 md:gap-4 md:px-6">
      <MobileNav />
      <Link href="/" className="flex min-w-0 items-baseline gap-2">
        <span className="text-gradient-brand text-base font-semibold tracking-tight">
          {siteConfig.name}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {siteConfig.tagline}
        </span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        <HeaderClock />
        <ThemeToggle />
      </div>
    </header>
  );
}
