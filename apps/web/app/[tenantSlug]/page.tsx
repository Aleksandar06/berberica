import { ArrowRight, MapPin, Phone, Scissors, Sparkles } from "lucide-react";
import Link from "next/link";

import { publicApi } from "@/lib/api/public";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatPrice } from "@/lib/format/money";
import { getServerT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

/**
 * Storefront home — Treatwell-style single-page surface. Hero, then
 * services right inline (no need to navigate to a separate page for the
 * primary thing the customer came here to do), then the team, then
 * contact card. Booking is one tap from any service card.
 */
export default async function StorefrontHome({ params }: Props) {
  const { tenantSlug } = await params;
  const [{ t }, profile, services, staff] = await Promise.all([
    getServerT(),
    publicApi.getProfile(tenantSlug),
    publicApi.getServices(tenantSlug),
    publicApi.getStaff(tenantSlug),
  ]);
  const businessTypeLabel = profile.businessType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* HERO — soft brand-coloured backdrop, two-column on desktop with
          the embedded location map on the right. The left column carries
          the badge/title/address/CTAs; the right column shows the venue on
          a Google Maps iframe so a first-time customer can see exactly
          where they're booking before they tap. */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/[0.08] via-card to-accent/30 fade-in">
        <div
          aria-hidden
          className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_minmax(14rem,17rem)] lg:items-center lg:gap-10">
          <div className="space-y-4">
            <Badge
              variant="secondary"
              className="uppercase tracking-wide text-[10px]"
            >
              {businessTypeLabel}
            </Badge>
            <h1 className="text-display sm:text-[3rem] sm:leading-[1.05] font-bold text-foreground max-w-2xl">
              {profile.name}
            </h1>
            {profile.address && (
              <p className="flex items-center gap-2 text-base text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {profile.address}
              </p>
            )}
            {/* CTAs — we apply buttonVariants directly to the anchors rather
                than wrapping in <Button asChild>. The Slot-based asChild
                pattern silently drops className through next/link in this
                project, so anchor styling never landed. Direct className keeps
                the design system intact (same tokens, same sizing) without
                the prop-merging hazard. */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3">
              <Link
                href={`/${tenantSlug}/book`}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5",
                )}
              >
                {t.storefront.bookAppointment}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {profile.contactPhone && (
                <a
                  href={`tel:${profile.contactPhone}`}
                  className={buttonVariants({ variant: "ghost", size: "lg" })}
                >
                  <Phone className="h-4 w-4" />
                  {t.storefront.callUs}
                </a>
              )}
            </div>
          </div>

          {profile.address && (
            <LocationMap
              address={profile.address}
              name={profile.name}
              directionsLabel={t.storefront.getDirections}
            />
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-h2 text-foreground">{t.storefront.servicesHeading}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.storefront.servicesSubtitle}{" "}
              <span className="tabular-nums">({profile.timezone})</span>
            </p>
          </div>
          {services.length > 4 && (
            <Link
              href={`/${tenantSlug}/services`}
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.storefront.seeAll} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title={t.storefront.noServices}
            description={t.storefront.noServicesBody}
          />
        ) : (
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${tenantSlug}/book?serviceId=${s.id}`}
                  className="block rounded-2xl border border-border bg-card p-4 sm:p-5 transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{s.name}</p>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatPrice(s.priceCents, profile.currency, {
                          fallback: "—",
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {s.durationMinutes} min
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" aria-hidden />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* STAFF */}
      {staff.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h2 text-foreground">{t.storefront.meetTheTeam}</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {staff.map((s) => {
              const initials =
                s.displayName
                  .split(" ")
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?";
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-4 text-center"
                >
                  <Avatar className="h-16 w-16 mx-auto mb-2">
                    <AvatarFallback className="text-lg font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-foreground text-sm truncate">
                    {s.displayName}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ABOUT */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-h3 text-foreground">{t.storefront.aboutHeading}</h2>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {profile.address && (
            <InfoRow label={t.storefront.address} value={profile.address} />
          )}
          {profile.contactPhone && (
            <InfoRow
              label={t.storefront.phone}
              value={
                <a
                  href={`tel:${profile.contactPhone}`}
                  className="text-primary font-medium hover:underline"
                >
                  {profile.contactPhone}
                </a>
              }
            />
          )}
          {profile.contactEmail && (
            <InfoRow
              label={t.storefront.emailLabel}
              value={
                <a
                  href={`mailto:${profile.contactEmail}`}
                  className="text-primary font-medium hover:underline"
                >
                  {profile.contactEmail}
                </a>
              }
            />
          )}
          <InfoRow label={t.storefront.timezone} value={profile.timezone} />
        </dl>
      </section>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Embedded Google Maps view of the venue address. Uses the keyless
 * `maps.google.com/maps?q=…&output=embed` endpoint so we don't have to
 * manage an API key for the hackathon.
 *
 * Query is the address-only (not the business name) so Google geocodes
 * to the exact street pin instead of trying to match a business in its
 * index — that match was unreliable for fresh tenants. The "Get
 * directions" link below still carries the business name as the
 * destination label so the user's Maps app shows a familiar title.
 */
function LocationMap({
  address,
  name,
  directionsLabel,
}: {
  address: string;
  name: string;
  directionsLabel: string;
}) {
  const addressQuery = encodeURIComponent(address);
  const embedSrc = `https://maps.google.com/maps?q=${addressQuery}&z=16&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${name}, ${address}`,
  )}`;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <iframe
        title={`Map showing the location of ${name}`}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block w-full aspect-[5/3] border-0"
      />
      <a
        href={directionsHref}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground border-t border-border hover:bg-muted transition"
      >
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
          {directionsLabel}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </a>
    </div>
  );
}
