import { ArrowRight, Scissors } from "lucide-react";
import Link from "next/link";

import { publicApi } from "@/lib/api/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

/**
 * Dedicated services-browse page. Same data + visual vocabulary as the
 * inline services list on the storefront home — this page exists for
 * deep-linking (e.g. SEO landings on individual service names later) and
 * for the "See all" link when the home list is truncated.
 */
export default async function ServicesPage({ params }: Props) {
  const { tenantSlug } = await params;
  const services = await publicApi.getServices(tenantSlug);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose any service to start your booking.
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <Link href={`/${tenantSlug}/book`}>Book a service</Link>
        </Button>
      </header>

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
    </div>
  );
}
