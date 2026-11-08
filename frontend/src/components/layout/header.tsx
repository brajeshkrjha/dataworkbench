import Link from "next/link";

import { siteConfig } from "@/config/site";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-6">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="text-gradient-brand text-base font-semibold tracking-tight">
          {siteConfig.name}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {siteConfig.tagline}
        </span>
      </Link>
    </header>
  );
}
