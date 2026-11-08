import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Left-aligned "Home / Utility / Tool" trail. Every non-final item is a
 * clickable link with a generous hit area so it's easy to jump back a
 * level without hunting for a small arrow. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
      <Crumb href="/" isFirst>
        <Home className="h-3.5 w-3.5" />
        <span>Home</span>
      </Crumb>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            {isLast || !item.href ? (
              <span
                className="rounded-md px-1.5 py-1 font-medium text-foreground"
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Crumb href={item.href}>{item.label}</Crumb>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Crumb({
  href,
  isFirst,
  children,
}: {
  href: string;
  isFirst?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
        isFirst ? "-ml-1.5" : ""
      }`}
    >
      {children}
    </Link>
  );
}
