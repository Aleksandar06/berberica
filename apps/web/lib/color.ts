/**
 * Color utilities. We store tenant brand colors as hex (`#1f2937`) but our
 * design tokens are HSL component triplets so Tailwind can compose them
 * with alpha modifiers (`bg-primary/10`). These helpers bridge the two.
 */

export interface HslComponents {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Parse a hex color (`#abc` or `#aabbcc`) into HSL components. Falls back
 * to slate-900 if the input doesn't match (so a bad branding row can't
 * blow up the storefront).
 */
export function hexToHsl(hex: string): HslComponents {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    return { h: 240, s: 10, l: 12 };
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const light = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      case b:
        hue = (r - g) / d + 4;
        break;
    }
    hue /= 6;
  }
  return {
    h: Math.round(hue * 360),
    s: Math.round(sat * 100),
    l: Math.round(light * 100),
  };
}

/** Format `HslComponents` as a Tailwind-friendly `H S% L%` string. */
export function hslString({ h, s, l }: HslComponents): string {
  return `${h} ${s}% ${l}%`;
}

/**
 * Pick a readable foreground HSL string ("0 0% 100%" or "240 10% 12%")
 * for a background defined by the given HSL components. Threshold tuned
 * to match WCAG AA for body text on the most common brand-color shades.
 */
export function readableForeground(bg: HslComponents): string {
  return bg.l > 62 ? "240 10% 12%" : "0 0% 100%";
}
