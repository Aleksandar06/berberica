import { ArrowRight, MapPin, Phone, Scissors, Sparkles } from "lucide-react";
import Link from "next/link";

import { publicApi } from "@/lib/api/public";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

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
  const [profile, services, staff] = await Promise.all([
    publicApi.getProfile(tenantSlug),
    publicApi.getServices(tenantSlug),
    publicApi.getStaff(tenantSlug),
  ]);
  const businessTypeLabel = profile.businessType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* HERO */}
      <section className="space-y-4">
        <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
          {businessTypeLabel}
        </Badge>
        <h1 className="text-display sm:text-[3rem] sm:leading-[1.05] font-bold text-foreground">
          {profile.name}
        </h1>
        {profile.address && (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {profile.address}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild size="lg">
            <Link href={`/${tenantSlug}/book`}>
              Book an appointment
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {profile.contactPhone && (
            <Button asChild variant="secondary" size="lg">
              <a href={`tel:${profile.contactPhone}`}>
                <Phone className="h-4 w-4" />
                Call us
              </a>
            </Button>
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-h2 text-foreground">Services</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tap a service to book it. Times are shown in {profile.timezone}.
            </p>
          </div>
          {services.length > 4 && (
            <Link
              href={`/${tenantSlug}/services`}
              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        {services.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="No services available yet"
            description="This business hasn't published any bookable services."
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
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className="tabular-nums">
                        {s.durationMinutes} min
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
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
          <h2 className="text-h2 text-foreground">Meet the team</h2>
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
          <h2 className="text-h3 text-foreground">About this venue</h2>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {profile.address && (
            <InfoRow label="Address" value={profile.address} />
          )}
          {profile.contactPhone && (
            <InfoRow
              label="Phone"
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
              label="Email"
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
          <InfoRow label="Timezone" value={profile.timezone} />
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
