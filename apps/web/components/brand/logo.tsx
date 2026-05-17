import { cn } from "@/lib/utils";

/**
 * Berberica brand logo — the Cyrillic lowercase letter "б" set in a
 * brand-coloured rounded-square pill. The Cyrillic glyph ties to the
 * platform's Balkan origins (Skopje-launched) while still reading as a
 * recognisable "b" to Latin-script readers — a quiet bilingual nod
 * without leaning on flag iconography.
 *
 *   <LogoMark />              ← just the glyph pill, for nav bars and avatars
 *   <Logo />                  ← mark + "Berberica" wordmark, for hero/auth panels
 *
 * Sizing is driven by the wrapper's class (h-* / w-*) so the same component
 * scales from a 16px favicon up to a 64px hero badge. Inter is loaded with
 * the Cyrillic subset in `app/layout.tsx` so the glyph renders in the same
 * typeface as the surrounding wordmark.
 */

export interface LogoMarkProps {
  /** Override the pill size — defaults to h-7 w-7 (28px), matching the existing dashboard pill. */
  className?: string;
  /**
   * Variant for placement on a coloured surface (e.g. the auth brand panel
   * which is already brand-coloured). "tinted" → translucent foreground pill
   * with the glyph in foreground colour, instead of the solid brand pill.
   */
  tone?: "brand" | "tinted";
}

export function LogoMark({ className, tone = "brand" }: LogoMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid place-items-center rounded-xl shrink-0 font-bold leading-none select-none",
        tone === "brand"
          ? "bg-primary text-primary-foreground"
          : "bg-primary-foreground/15 text-primary-foreground",
        // Default size; consumers override via className.
        "h-7 w-7 text-base",
        className,
      )}
    >
      {/* Cyrillic lowercase "be". The tiny negative margin compensates for
          the glyph's optical centring — sits visually flush in the pill. */}
      <span className="-mt-[1px]">б</span>
    </span>
  );
}

export interface LogoProps {
  className?: string;
  /** Brand pill tone (see LogoMark). */
  tone?: "brand" | "tinted";
  /** Override wordmark size (default text-base). */
  wordmarkClassName?: string;
}

export function Logo({
  className,
  tone = "brand",
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <LogoMark tone={tone} />
      <span
        className={cn(
          "font-semibold truncate",
          tone === "brand"
            ? "text-foreground"
            : "text-primary-foreground",
          wordmarkClassName ?? "text-base",
        )}
      >
        Berberica
      </span>
    </span>
  );
}
