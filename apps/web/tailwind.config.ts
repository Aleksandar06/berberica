import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Treatwell-inspired design system.
 *
 * Colors are exposed as HSL CSS variables in `app/globals.css` so a tenant
 * can override `--primary` etc. via inline style on the storefront layout
 * without us rebuilding Tailwind. The platform default is a warm magenta
 * — close to Treatwell's pink/coral brand — so unbranded pages (landing,
 * auth, customer dashboard) carry the platform identity.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em", fontWeight: "700" }],
        "h1": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        "h2": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        "h3": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        // Body + label scales — fills the gap below h3. Hand-rolled text-sm/
        // text-base were scattered everywhere; these named tokens give us
        // consistent line-height and feature settings.
        "body": ["0.9375rem", { lineHeight: "1.55" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5" }],
        "label": ["0.75rem", { lineHeight: "1.2", letterSpacing: "0.08em", fontWeight: "600", textTransform: "uppercase" } as never],
        "caption": ["0.6875rem", { lineHeight: "1.4" }],
      },
      boxShadow: {
        "sm": "0 1px 2px 0 hsl(var(--foreground) / 0.04)",
        "DEFAULT": "0 1px 3px 0 hsl(var(--foreground) / 0.06), 0 1px 2px -1px hsl(var(--foreground) / 0.06)",
        "md": "0 4px 12px -2px hsl(var(--foreground) / 0.08), 0 2px 4px -2px hsl(var(--foreground) / 0.04)",
        "lg": "0 12px 32px -8px hsl(var(--foreground) / 0.12), 0 4px 12px -4px hsl(var(--foreground) / 0.06)",
        "xl": "0 24px 56px -12px hsl(var(--foreground) / 0.18)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
