import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/public";
import type { PublicTenantProfile } from "@/lib/api/types";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

/**
 * Per-tenant layout. Server-fetches the public profile so brand colors,
 * name, and logo are in the first paint (avoids the "flash of un-branded
 * content"). The profile fetch also drives the three error contracts:
 *
 *   • 404 → `notFound()` → renders `app/[tenantSlug]/not-found.tsx`
 *   • 403 with TENANT_SUSPENDED → renders SuspendedPage right here
 *   • anything else → re-throws → Next's error boundary
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

  // Inject brand colors as CSS variables — components reference them via
  // `var(--brand-*)` so the same component renders differently per tenant.
  const brandStyle: CSSProperties = {
    "--brand-primary":
      profile.branding?.primaryColor ?? "#0f172a",
    "--brand-secondary":
      profile.branding?.secondaryColor ?? "#3b82f6",
    "--brand-accent":
      profile.branding?.accentColor ?? "#f59e0b",
    "--brand-on-primary": "#ffffff",
  } as CSSProperties;

  return (
    <div style={brandStyle} className="min-h-screen flex flex-col">
      <TenantHeader profile={profile} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <TenantFooter profile={profile} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------

function TenantHeader({ profile }: { profile: PublicTenantProfile }) {
  return (
    <header
      className="brand-bg"
      // Inline shadow keeps the brand color contained without a global rule.
      style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.05)" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href={`/${profile.slug}`}
          className="flex items-center gap-3"
          aria-label={`${profile.name} — home`}
        >
          {profile.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.branding.logoUrl}
              alt=""
              className="h-9 w-9 rounded bg-white object-contain p-1"
            />
          ) : (
            <span
              className="h-9 w-9 rounded bg-white/15 grid place-items-center text-base font-semibold"
              aria-hidden
            >
              {profile.name.slice(0, 1)}
            </span>
          )}
          <span className="text-lg font-semibold">{profile.name}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href={`/${profile.slug}/services`}
            className="hover:underline opacity-90 hover:opacity-100"
          >
            Services
          </Link>
          <Link
            href={`/${profile.slug}/book`}
            className="rounded bg-white/15 hover:bg-white/25 px-3 py-1.5 transition"
          >
            Book now
          </Link>
        </nav>
      </div>
    </header>
  );
}

function TenantFooter({ profile }: { profile: PublicTenantProfile }) {
  return (
    <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      <div className="max-w-5xl mx-auto px-6 space-y-1">
        <p>
          {profile.name} · Times shown in{" "}
          <span className="font-medium">{profile.timezone}</span>
        </p>
        {(profile.contactEmail || profile.contactPhone) && (
          <p>
            {profile.contactEmail && (
              <a
                href={`mailto:${profile.contactEmail}`}
                className="text-slate-600 hover:underline"
              >
                {profile.contactEmail}
              </a>
            )}
            {profile.contactEmail && profile.contactPhone && " · "}
            {profile.contactPhone && (
              <a
                href={`tel:${profile.contactPhone}`}
                className="text-slate-600 hover:underline"
              >
                {profile.contactPhone}
              </a>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// SUSPENDED — replaces the whole layout body when the tenant is suspended.
// ---------------------------------------------------------------------------

function SuspendedPage({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 grid place-items-center">
          <span aria-hidden className="text-amber-700 text-2xl">⏸</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Temporarily unavailable
        </h1>
        <p className="text-slate-600">
          This business is currently not accepting online bookings. Please
          check back later.
        </p>
        <p className="text-xs text-slate-400 pt-4">slug: {tenantSlug}</p>
      </div>
    </div>
  );
}
