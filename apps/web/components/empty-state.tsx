import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Lucide icon component (e.g. `Calendar`, `Users`). Renders in a soft circular tile. */
  icon?: LucideIcon;
  /**
   * Optional richer illustration that sits above the icon tile — use it for
   * marquee empty states (no bookings yet, first-time onboarding) where a
   * single glyph is too plain. Plain icon tile remains the default.
   */
  illustration?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary action (typically a Button or Link). */
  action?: ReactNode;
  className?: string;
}

/**
 * Standard empty / no-content state for any list or table. Mobile-first
 * — generous vertical padding, centered, easy to read at arm's length.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center",
        className,
      )}
    >
      {illustration && (
        <div className="max-w-[16rem]" aria-hidden>
          {illustration}
        </div>
      )}
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-h3 text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
