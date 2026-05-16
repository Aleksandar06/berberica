import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * Brand-aware button. `primary` and `secondary` pull from the per-tenant
 * CSS variables set in `app/[tenantSlug]/layout.tsx`, so each storefront
 * looks distinct without a per-tenant Tailwind build.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", ...rest }, ref) {
    const base =
      variant === "primary"
        ? "btn-primary"
        : variant === "secondary"
          ? "btn-secondary"
          : "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50";
    return <button ref={ref} className={cn(base, className)} {...rest} />;
  },
);
