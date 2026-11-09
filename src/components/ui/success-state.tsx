import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface SuccessStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function SuccessState({
  title = "تمت العملية بنجاح",
  message,
  actionLabel,
  onAction,
  className,
}: SuccessStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md max-w-lg mx-auto my-6",
        className,
      )}
      dir="rtl"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-4 shadow-sm">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-bold font-display text-foreground mb-2">{title}</h3>
      {message && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {message}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="gold" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

