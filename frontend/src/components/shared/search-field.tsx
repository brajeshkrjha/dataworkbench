"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared compact search field. The focus ring lives on the wrapper
 * (`focus-within`) so the native input never draws a second outline.
 */
export function SearchField({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div
      className={cn(
        "flex h-10 w-full max-w-xs items-center gap-2.5 rounded-lg border border-border bg-card px-3 shadow-sm transition-[border-color,box-shadow]",
        "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/20",
        className
      )}
    >
      <Search aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        className="h-full min-w-0 flex-1 appearance-none bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none"
        {...props}
      />
    </div>
  );
}

