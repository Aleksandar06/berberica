import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import { hexToHsl, hslString, readableForeground } from "@/lib/color";
import { publicApi } from "@/lib/api/public";
import type { PublicTenantProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

/**
 * Per-tenant layout. Server-fetches the public profile so brand colors,
 * name, and logo are in the first paint (avoids the "flash of un-branded
 * content"). Three error contracts:
 *
 *   • 404 → `notFound()` → renders `app/[tenantSlug]/not-found.tsx`
 *   • 403 with TENANT_SUSPENDED → renders SuspendedPage right here
 *   • anything else → re-throws → Next's error boundary
 *
 * Brand wiring (Phase 6): injects BOTH the legacy `--brand-*` hex vars
 * (so older `.btn-primary` / `.brand-bg` shims keep working) AND the
 * new HSL-component semantic tokens (`--primary`, `--ring`, `--accent`,
 * `--accent-foreground`) so every shadcn primitive used inside the
 * storefront — Button, Badge, the booking flow's slot picker, etc. —
 * inherits the tenant's brand color automatically. No per-tenant build.
 */
export default async function TenantLayout({ children, params }: LayoutProps) {
  const { tenantSlug } = await params;
  let profile: PublicTenantProfile;
  try {
    profile = await publicApi.getProfile(tenantSlug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    if (err instanceof ApiError && err.code === "TENANT_SUSPENDED") {
      return <SuspendedPage tenantSlug={tenantSlug} />;
    }
    throw err;
  }

  // Map tenant brand hex → semantic HSL tokens. Accent (light brand surface)
  // shares the brand hue but boosts lightness so it works as a chip / hover
  // background regardless of how dark the primary is.
  const primaryHex = profile.branding?.primaryColor ?? "#1f2937";
  const secondaryHex = profile.branding?.secondaryColor ?? "#3b82f6";
  const accentHex = profile.branding?.accentColor ?? "#f59e0b";
  const primaryHsl = hexToHsl(primaryHex);
  const primaryHslString = hslString(primaryHsl);
  const accentLight = `${primaryHsl.h} ${Math.max(40, Math.min(80, primaryHsl.s))}% 96%`;
  const accentDark = `${primaryHsl.h} ${Math.max(40, primaryHsl.s)}% 28%`;
  const onPrimary = readableForeground(primaryHsl);

  const brandStyle: CSSProperties = {
    // Legacy hex vars — kept for back-compat with `.btn-primary`/`.brand-bg`.
    "--brand-primary": primaryHex,
    "--brand-secondary": secondaryHex,
    "--brand-accent": accentHex,
    "--brand-on-primary": onPrimary === "0 0% 100%" ? "#ffffff" : "#1f1f24",
    // New semantic tokens — every shadcn primitive on the storefront
    // (Button, Badge, slot picker, OTP boxes…) inherits these.
    "--primary": primaryHslString,
    "--primary-foreground": onPrimary,
    "--ring": primaryHslString,
    "--accent": accentLight,
    "--accent-foreground": accentDark,
  } as CSSProperties;

  return (
    <div style={brandStyle} className="min-h-screen flex flex-col bg-background">
      <TenantHeader profile={profile} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
      <TenantFooter profile={profile} />
    </div>
  );
}

// ===========================================================================
// HEADER
// ===========================================================================

function TenantHeader({ profile }: { profile: PublicTenantProfile }) {
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link
          href={`/${profile.slug}`}
          className="flex items-center gap-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label={`${profile.name} — home`}
        >
          {profile.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.branding.logoUrl}
              alt=""
              className="h-11 w-11 rounded-xl bg-card object-contain p-1 border border-border shrink-0"
            />
          ) : (
            <span
              className="h-11 w-11 rounded-xl grid place-items-center text-lg font-bold shrink-0 bg-primary text-primary-foreground"
              aria-hidden
            >
              {profile.name.slice(0, 1)}
            </span>
          )}
          <span className="text-base sm:text-lg font-semibold text-foreground truncate">
            {profile.name}
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link
            href={`/${profile.slug}/services`}
            className="hidden sm:inline-flex h-10 px-3 items-center rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Services
          </Link>
          <Button asChild size="md">
            <Link href={`/${profile.slug}/book`}>Book now</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

// ===========================================================================
// FOOTER
// ===========================================================================

function TenantFooter({ profile }: { profile: PublicTenantProfile }) {
  return (
    <footer className="border-t border-border bg-muted/30 mt-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid sm:grid-cols-3 gap-6 text-sm">
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground">{profile.name}</p>
          <p className="text-muted-foreground">
            Bookings in{" "}
            <span className="font-medium text-foreground">{profile.timezone}</span>.
          </p>
        </div>
        <div className="space-y-2 text-muted-foreground">
          {profile.address && (
            <p className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>{profile.address}</span>
            </p>
          )}
          {profile.contactPhone && (
            <p>
              <a
                href={`tel:${profile.contactPhone}`}
                className="inline-flex items-center gap-2 hover:text-foreground transition"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                {profile.contactPhone}
              </a>
            </p>
          )}
          {profile.contactEmail && (
            <p>
              <a
                href={`mailto:${profile.contactEmail}`}
                className="inline-flex items-center gap-2 hover:text-foreground transition"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                {profile.contactEmail}
              </a>
            </p>
          )}
        </div>
        <div className="text-xs text-muted-foreground sm:text-right space-y-1">
          <p>
            Powered by{" "}
            <Link
              href="/"
              className="font-medium text-foreground hover:text-primary transition"
            >
              Glamora
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

// ===========================================================================
// SUSPENDED
// ===========================================================================

function SuspendedPage({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-warning/15 grid place-items-center text-[hsl(30_60%_28%)]">
          <span aria-hidden className="text-2xl">⏸</span>
        </div>
        <h1 className="text-h1 text-foreground">Temporarily unavailable</h1>
        <p className="text-muted-foreground">
          This business isn&apos;t accepting online bookings right now. Please
          check back later.
        </p>
        <p className="text-xs font-mono text-muted-foreground pt-4">
          {tenantSlug}
        </p>
      </div>
    </div>
  );
}
