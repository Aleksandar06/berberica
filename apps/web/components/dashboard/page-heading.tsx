import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Pre-Phase-1 page header — kept for back-compat across dashboard pages.
 * New screens should use `<PageHeader>` from `@/components/page-header`
 * which adds breadcrumbs and richer styling.
 */
export function PageHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h1 text-foreground truncate">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
