import Image from "next/image";

import { ToolIcon } from "@/components/shared/tool-icon";
import { cn } from "@/lib/utils";

/** Brand logos in /public/logos, keyed by tool id. Tools without one fall back to their registry icon. */
export const TOOL_LOGOS: Record<string, string> = {
  "gcp-looker-utility": "/logos/gcp-looker-utility.png",
  "parquet-utility": "/logos/parquet-utility.png",
  "text-compare-utility": "/logos/text-compare-utility.jpg",
};

const SIZES = {
  sm: { box: "h-8 w-8 rounded-md", icon: "h-4 w-4", px: 32 },
  md: { box: "h-10 w-10 rounded-lg", icon: "h-5 w-5", px: 40 },
  lg: { box: "h-12 w-12 rounded-lg", icon: "h-6 w-6", px: 48 },
} as const;

/** Tool avatar: the tool's logo when available, otherwise its icon on a tinted tile. */
export function ToolLogo({
  toolId,
  icon,
  size = "md",
  className,
}: {
  toolId?: string;
  icon: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const logo = toolId ? TOOL_LOGOS[toolId] : undefined;
  const s = SIZES[size];

  if (logo) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden bg-white p-1 ring-1 ring-border/70",
          s.box,
          className
        )}
      >
        <Image src={logo} alt="" width={s.px} height={s.px} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-secondary text-primary", s.box, className)}>
      <ToolIcon name={icon} className={s.icon} />
    </span>
  );
}
