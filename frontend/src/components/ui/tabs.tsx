"use client";

import { createContext, useCallback, useContext, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  id: string;
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`<${component}> must be used within <Tabs>`);
  return context;
}

export function Tabs({
  defaultValue,
  className,
  onValueChange,
  children,
}: {
  defaultValue: string;
  className?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const handleSetValue = useCallback((next: string) => {
    setValue(next);
    onValueChange?.(next);
  }, [onValueChange]);
  const context = useMemo(() => ({ id, value, setValue: handleSetValue }), [id, value, handleSetValue]);
  return (
    <TabsContext.Provider value={context}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = event.target;
    if (!(current instanceof HTMLButtonElement) || current.getAttribute("role") !== "tab") return;
    if (current.closest('[role="tablist"]') !== event.currentTarget) return;

    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .filter((tab) => !tab.disabled && tab.closest('[role="tablist"]') === event.currentTarget);
    const index = tabs.indexOf(current);
    if (index < 0) return;
    let next: HTMLButtonElement | undefined;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    else return;

    event.preventDefault();
    // Manual activation: moving focus must not fetch a potentially expensive
    // analyzer tab. Native Enter/Space or a click activates it as before.
    next?.focus();
  };

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const { id, value: active, setValue } = useTabsContext("TabsTrigger");
  const isActive = active === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${id}-tab-${value}`}
      aria-controls={`${id}-panel-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1.5",
        isActive
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const { id, value: active } = useTabsContext("TabsContent");
  if (active !== value) return null;
  return (
    <div role="tabpanel" id={`${id}-panel-${value}`} aria-labelledby={`${id}-tab-${value}`} tabIndex={0} className={className}>
      {children}
    </div>
  );
}
