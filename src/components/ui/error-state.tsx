import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "حدث خطأ غير متوقع",
  message = "تعذر تحميل البيانات المطلوبة في الوقت الحالي. يرجى المحاولة مرة أخرى.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-destructive/30 bg-destructive/5 backdrop-blur-md max-w-lg mx-auto my-6",
        className,
      )}
      dir="rtl"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold font-display text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>إعادة المحاولة</span>
        </Button>
      )}
    </div>
  );
}

