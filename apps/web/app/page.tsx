import {
  ArrowRight,
  CalendarCheck,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FeaturedTenant {
  slug: string;
  name: string;
  businessType: string;
  blurb: string;
}

const FEATURED: FeaturedTenant[] = [
  {
    slug: "elite-barbers",
    name: "Elite Barbers",
    businessType: "Barbershop",
    blurb: "Centar, Skopje — classic cuts and hot-towel shaves.",
  },
  {
    slug: "smile-dental",
    name: "Smile Dental",
    businessType: "Dental clinic",
    blurb: "Karpoš, Skopje — cleanings, consultations, and check-ups.",
  },
];

/**
 * Platform landing — the front door for both customers (looking for a
 * venue to book at) and prospective tenants (looking to list their
 * business). Mobile-first hero + features + featured venues + a soft
 * CTA to register a business, and a global footer.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-accent/40 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 sm:pb-24 text-center">
          <Badge variant="secondary" className="mb-5">
            <Sparkles className="h-3 w-3 mr-1" />
            Booking for beauty, wellness & barbershops
          </Badge>
          <h1 className="text-display sm:text-[3.5rem] sm:leading-[1.05] font-bold text-foreground tracking-tight max-w-3xl mx-auto">
            Bookings without the back-and-forth.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mt-5 max-w-2xl mx-auto">
            One platform for booking your favourite venues — and a clean,
            fast dashboard for the businesses behind them.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link href="#venues">
                Find a business
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/dashboard/login">For business owners</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          <Feature
            icon={CalendarCheck}
            title="Real-time availability"
            body="Tap a time, lock it in. No double-bookings, no waiting for someone to confirm."
          />
          <Feature
            icon={ShieldCheck}
            title="Verified everywhere"
            body="Email verification, role-based access, and per-tenant data isolation on every account."
          />
          <Feature
            icon={Clock}
            title="Built for mobile"
            body="The booking flow looks like a native app and works in your thumb-reach band — even on a 4-inch screen."
          />
        </div>
      </section>

      {/* VENUES */}
      <section
        id="venues"
        className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6"
      >
        <div className="space-y-2 text-center">
          <h2 className="text-h1 text-foreground">Featured venues</h2>
          <p className="text-muted-foreground">
            Tap any venue to see their services and book.
          </p>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {FEATURED.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/${t.slug}`}
                className="block rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {t.businessType}
                    </Badge>
                    <p className="font-semibold text-foreground mt-2">
                      {t.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.blurb}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-5 w-5 text-muted-foreground mt-1 shrink-0"
                    aria-hidden
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* BUSINESS CTA */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[2fr_1fr] gap-8 items-center">
          <div className="space-y-3">
            <h2 className="text-h1 text-foreground">
              Run a salon, barbershop or wellness studio?
            </h2>
            <p className="text-muted-foreground">
              Set up your services, hours, and team in minutes. Whitelabel
              branding included — your venue page looks like yours, not ours.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 lg:justify-end">
            <Button asChild size="lg">
              <Link href="/dashboard/register">Create an account</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/dashboard/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <LogoMark />
          Berberica
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/dashboard/login"
            className="inline-flex h-10 px-3 items-center rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            Sign in
          </Link>
          <Button asChild size="md">
            <Link href="/dashboard/register">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="text-h3 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Berberica — multi-tenant scheduling.</p>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/login" className="hover:text-foreground transition">
            Sign in
          </Link>
          <Link href="/dashboard/register" className="hover:text-foreground transition">
            Create account
          </Link>
        </div>
      </div>
    </footer>
  );
}
