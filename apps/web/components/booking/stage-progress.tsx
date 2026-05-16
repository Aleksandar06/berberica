"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Slim progress indicator for multi-step flows. Renders as a compact pill
 * track on mobile (just the step bars), and a labelled stepper on desktop.
 *
 * Pass an array of step labels in order, and the current 0-based index.
 * Steps before `current` render filled, the current step gets a brand
 * outline, future steps stay neutral.
 */
export interface StageProgressProps {
  steps: string[];
  current: number;
  className?: string;
}

export function StageProgress({ steps, current, className }: StageProgressProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Mobile-first track */}
      <div className="flex items-center gap-1.5 sm:hidden" aria-hidden>
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < current
                ? "bg-primary"
                : i === current
                  ? "bg-primary/80"
                  : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="sm:hidden mt-2 text-xs font-medium text-muted-foreground">
        Step {Math.min(current + 1, steps.length)} of {steps.length} ·{" "}
        <span className="text-foreground">{steps[current] ?? "Done"}</span>
      </p>

      {/* Desktop labelled stepper */}
      <ol className="hidden sm:flex items-center gap-1.5">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={label}
              className="flex items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "font-medium text-foreground"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <span className="text-border ml-1" aria-hidden>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
