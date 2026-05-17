"use client";

import { DateTime } from "luxon";
import { CheckCircle2, Phone, UserX } from "lucide-react";
import { useEffect, useState } from "react";

import type { BusinessBooking } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { cn } from "@/lib/utils";

export interface NextUpCardProps {
  /** Pre-filtered list of today's pending+confirmed bookings, sorted ascending. */
  upcoming: BusinessBooking[];
  timezone: string;
  /** Callback to flip a booking's status. Parent handles the mutation. */
  onMark: (booking: BusinessBooking, status: "confirmed" | "no_show") => void;
  /** Disable buttons while a mutation is in flight. */
  marking: boolean;
}

/**
 * The "what's happening right now" hero card at the top of the Today page.
 *
 * Shows:
 *  • live wall-clock time (ticks every 30s)
 *  • the next pending/confirmed booking with the customer's avatar, the
 *    service, when it starts ("in 8 min" / "now" / "5 min ago"), and
 *    one-tap "Arrived" + "No show" actions.
 *
 * Empty state: when nothing is pending in the next two hours, swaps to a
 * calm "you have a window" panel — useful for a barber considering a coffee.
 */
export function NextUpCard({
  upcoming,
  timezone,
  onMark,
  marking,
}: NextUpCardProps) {
  // Tick once every 30s — keeps relative-time labels accurate without
  // re-rendering constantly.
  const [now, setNow] = useState(() => DateTime.now().setZone(timezone));
  useEffect(() => {
    const id = setInterval(
      () => setNow(DateTime.now().setZone(timezone)),
      30_000,
    );
    return () => clearInterval(id);
  }, [timezone]);

  // "Next" = the soonest pending/confirmed booking that hasn't ended yet.
  // We include in-progress bookings so a barber mid-cut still sees the
  // current customer at the top.
  const next = upcoming.find((b) => {
    const end = DateTime.fromISO(b.endAt, { zone: "utc" }).setZone(timezone);
    return end >= now;
  });

  const headerClock = now.toFormat("HH:mm");
  const headerDay = now.setLocale("en-US").toFormat("cccc, LLL d");

  if (!next) {
    return (
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-sm fade-in">
        <Header clock={headerClock} day={headerDay} />
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3 text-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            You&apos;re clear for now. Nothing booked in the next hours.
          </p>
        </div>
      </section>
    );
  }

  const start = DateTime.fromISO(next.startAt, { zone: "utc" }).setZone(
    timezone,
  );
  const end = DateTime.fromISO(next.endAt, { zone: "utc" }).setZone(timezone);
  const inProgress = now >= start && now < end;
  const minsAway = Math.round(start.diff(now, "minutes").minutes);
  const relative =
    inProgress
      ? "in progress now"
      : minsAway <= 0
        ? "starting now"
        : minsAway < 60
          ? `in ${minsAway} min`
          : minsAway < 120
            ? "in about an hour"
            : start.toFormat("'at' HH:mm");

  const initials =
    `${next.customer.firstName[0] ?? ""}${next.customer.lastName[0] ?? ""}`.toUpperCase();
  const accent = inProgress
    ? "from-primary/15 via-primary/[0.04] border-primary/30"
    : minsAway <= 10
      ? "from-warning/15 via-warning/[0.04] border-warning/30"
      : "from-primary/[0.08] via-card border-border";

  return (
    <section
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-sm fade-in",
        accent,
      )}
    >
      <Header clock={headerClock} day={headerDay} />

      <div className="mt-4 flex items-start gap-4">
        <span
          aria-hidden
          className="grid place-items-center h-14 w-14 shrink-0 rounded-full bg-primary text-primary-foreground text-lg font-semibold shadow-sm"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Next up
            </span>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {relative}
            </span>
          </div>
          <p className="text-h2 text-foreground leading-tight truncate">
            {next.customer.firstName} {next.customer.lastName}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {next.service.name} · with {next.staffMember.displayName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")} ·{" "}
            {end.diff(start, "minutes").minutes} min
          </p>
        </div>
        <div className="hidden sm:block">
          <StatusBadge status={next.status} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => onMark(next, "confirmed")}
          disabled={marking || next.status === "confirmed"}
          leadingIcon={<CheckCircle2 className="h-4 w-4" />}
        >
          {next.status === "confirmed" ? "Marked arrived" : "Arrived"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onMark(next, "no_show")}
          disabled={marking}
          leadingIcon={<UserX className="h-4 w-4" />}
        >
          No show
        </Button>
        {next.customer.phone && (
          <a
            href={`tel:${next.customer.phone}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-background border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition tabular-nums"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {next.customer.phone}
          </a>
        )}
      </div>
    </section>
  );
}

function Header({ clock, day }: { clock: string; day: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-h1 text-foreground tabular-nums leading-none">
        {clock}
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground tabular-nums">
        {day}
      </p>
    </div>
  );
}
