import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ label, size = "sm", className }: SpinnerProps) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 aria-hidden className={cn("animate-spin text-primary", sizeClass)} />
      {label ?? <span className="sr-only">Loading…</span>}
    </div>
  );
}
