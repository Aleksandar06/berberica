import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Treatwell-leaning button. Variants:
 *  - default / primary  → solid brand pill (used for the main CTA on a screen)
 *  - secondary          → outlined pill in neutral
 *  - destructive        → solid red, for delete/cancel actions
 *  - outline            → outlined in the neutral border color
 *  - ghost              → text-only, transparent until hover
 *  - link               → underlined link styling
 *  - subtle             → muted fill, for low-emphasis chips
 *
 * `primary` and `secondary` are kept as aliases for the previous Phase-0
 * API so older pages keep rendering. New code should prefer the shadcn
 * names (`default`, `outline`, etc).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
        secondary:
          "border border-input bg-background text-foreground hover:bg-muted",
        outline:
          "border border-input bg-background text-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110",
        ghost:
          "text-foreground hover:bg-muted",
        link:
          "text-primary underline-offset-4 hover:underline",
        subtle:
          "bg-muted text-foreground hover:bg-accent",
      },
      size: {
        sm: "h-9 px-3.5 rounded-full text-sm gap-1.5",
        md: "h-11 px-5 rounded-full text-sm gap-2",
        lg: "h-12 px-6 rounded-full text-base gap-2",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. Next/Link) while inheriting button styles. */
  asChild?: boolean;
  /** Replace contents with a spinner; preserves width so layout doesn't jump. */
  loading?: boolean;
  /** Icon rendered before children. Pass any Lucide icon element. */
  leadingIcon?: ReactNode;
  /** Icon rendered after children. */
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      disabled,
      children,
      ...rest
    },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leadingIcon}
            {children}
            {trailingIcon}
          </>
        )}
      </Comp>
    );
  },
);

export { buttonVariants };
