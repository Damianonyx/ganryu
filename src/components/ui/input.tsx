import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-sm border border-line bg-ink-2 px-3 text-sm text-paper",
        "placeholder:text-mist outline-none transition-colors duration-150",
        "focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-paper/30",
        className,
      )}
      {...props}
    />
  );
}
