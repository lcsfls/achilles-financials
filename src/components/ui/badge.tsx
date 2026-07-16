import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  color,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
        className
      )}
      style={
        color
          ? { borderColor: `${color}40`, backgroundColor: `${color}14`, color }
          : undefined
      }
      {...props}
    >
      {children}
    </span>
  );
}
