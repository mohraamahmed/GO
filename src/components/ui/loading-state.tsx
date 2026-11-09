import * as React from "react";
import { Aperture, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export interface LoadingStateProps {
  label?: string;
  className?: string;
  variant?: "spinner" | "skeleton-grid";
  count?: number;
}

export function LoadingState({
  label = "جاري التحميل...",
  className,
  variant = "spinner",
  count = 6,
}: LoadingStateProps) {
  if (variant === "skeleton-grid") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 my-6", className)} dir="rtl">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-10 max-w-sm mx-auto my-8",
        className,
      )}
      dir="rtl"
    >
      <div className="relative mb-4 flex items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Aperture className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <Loader2 className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-spin" />
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">{label}</p>
    </div>
  );
}

