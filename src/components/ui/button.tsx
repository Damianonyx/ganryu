import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-body tracking-[0.18em] uppercase transition-opacity duration-(--dur-fast) ease-(--ease-enter) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        solid:
          "bg-paper text-ink hover:opacity-90 active:scale-[0.98]",
        ghost:
          "bg-transparent text-paper border border-line hover:border-line-strong hover:bg-paper/5",
        text: "bg-transparent text-paper-dim hover:text-paper",
      },
      size: {
        lg: "h-12 px-7 text-xs rounded-sm",
        md: "h-10 px-5 text-xs rounded-sm",
        sm: "h-9 px-3 text-[0.68rem] rounded-xs",
        icon: "size-11 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "lg",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
