import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary shadow-sm",
        gold:
          "border-primary/40 bg-gradient-to-r from-primary/25 to-primary/15 text-primary font-bold shadow-sm",
        secondary:
          "border-border/60 bg-secondary/80 text-secondary-foreground",
        success:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-medium",
        warning:
          "border-amber-500/30 bg-amber-500/15 text-amber-300 font-medium",
        destructive:
          "border-rose-500/30 bg-rose-500/15 text-rose-300 font-medium",
        info:
          "border-sky-500/30 bg-sky-500/15 text-sky-300 font-medium",
        outline:
          "border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
