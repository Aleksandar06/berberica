import { CalendarCheck, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";

/**
 * Two-pane shell for auth screens. On desktop the left pane is a
 * branded gradient panel with the platform identity + a few trust
 * cues; on mobile only the right pane (the form) renders so a phone
 * keyboard doesn't fight the brand panel for space.
 *
 * Children should be a self-contained card (background, border,
 * padding); this component just centers and frames it.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside
        aria-hidden
        className="hidden lg:flex relative flex-col justify-between p-12 text-primary-foreground overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)",
        }}
      >
        {/* Decorative blur orbs for some warmth without an illustration */}
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "hsl(var(--accent-foreground))" }}
        />
        <div
          className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "hsl(var(--accent))" }}
        />

        <Link
          href="/"
          className="relative inline-flex items-center gap-2.5 text-base font-semibold w-fit"
        >
          <LogoMark tone="tinted" className="h-9 w-9" />
          Berberica
        </Link>

        <div className="relative space-y-5 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Bookings without the back-and-forth.
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            One platform for booking — and a clean dashboard for the venues
            who fulfil them.
          </p>
          <ul className="space-y-3 pt-2 text-sm">
            <Perk icon={<CalendarCheck className="h-4 w-4" />}>
              Real-time availability, no double-bookings
            </Perk>
            <Perk icon={<ShieldCheck className="h-4 w-4" />}>
              Email verification + role-based access on every account
            </Perk>
            <Perk icon={<Sparkles className="h-4 w-4" />}>
              Whitelabel branding for every venue
            </Perk>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Berberica
        </p>
      </aside>

      {/* Form pane */}
      <section className="flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}

function Perk({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/15 shrink-0">
        {icon}
      </span>
      <span className="text-primary-foreground/90">{children}</span>
    </li>
  );
}
