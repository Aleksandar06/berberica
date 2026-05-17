"use client";

import { DateTime } from "luxon";
import { Phone, User } from "lucide-react";

import type { BusinessBooking } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/status-badge";

export interface BookingsListViewProps {
  bookings: BusinessBooking[];
  timezone: string;
  onCancel: (booking: BusinessBooking) => void;
  onReschedule: (booking: BusinessBooking) => void;
}

/**
 * Polished list / table presentation for the bookings page.
 *
 *   Mobile  → grouped, time-anchored cards with a status-coloured rail.
 *   Desktop → tight table with a customer avatar tile and on-hover
 *             actions so the default row stays calm.
 *
 * Purely presentational — the parent owns queries and mutations.
 */
export function BookingsListView({
  bookings,
  timezone,
  onCancel,
  onReschedule,
}: BookingsListViewProps) {
  const grouped = groupByDay(bookings, timezone);

  return (
    <>
      {/* MOBILE — grouped time-anchored cards */}
      <div className="space-y-6 md:hidden">
        {grouped.map(({ key, label, sub, rows }) => (
          <section key={key} className="space-y-2">
            <div className="px-1 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {label}
              </h2>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {sub}
              </span>
            </div>
            <div className="space-y-2">
              {rows.map((b) => (
                <BookingMobileCard
                  key={b.id}
                  booking={b}
                  timezone={timezone}
                  onCancel={() => onCancel(b)}
                  onReschedule={() => onReschedule(b)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* DESKTOP — refined data table */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                When
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Service
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                With
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Customer
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const dt = DateTime.fromISO(b.startAt, { zone: "utc" }).setZone(
                timezone,
              );
              const end = DateTime.fromISO(b.endAt, { zone: "utc" }).setZone(
                timezone,
              );
              const modifiable =
                b.status === "pending" || b.status === "confirmed";

              return (
                <tr
                  key={b.id}
                  className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <p className="text-foreground font-medium tabular-nums">
                      {dt.toFormat("HH:mm")}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {dt.toFormat("ccc, LLL d")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 tabular-nums">
                      {end.diff(dt, "minutes").minutes} min
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-foreground">{b.service.name}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {b.staffMember.displayName}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-2.5">
                      <Avatar
                        firstName={b.customer.firstName}
                        lastName={b.customer.lastName}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {b.customer.firstName} {b.customer.lastName}
                        </p>
                        {b.customer.phone && (
                          <a
                            href={`tel:${b.customer.phone}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary tabular-nums"
                          >
                            <Phone className="h-3 w-3" aria-hidden />
                            {b.customer.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                    {modifiable && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReschedule(b)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onCancel(b)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ===========================================================================
// MOBILE CARD
// ===========================================================================

function BookingMobileCard({
  booking,
  timezone,
  onCancel,
  onReschedule,
}: {
  booking: BusinessBooking;
  timezone: string;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const dt = DateTime.fromISO(booking.startAt, { zone: "utc" }).setZone(
    timezone,
  );
  const end = DateTime.fromISO(booking.endAt, { zone: "utc" }).setZone(
    timezone,
  );
  const modifiable =
    booking.status === "pending" || booking.status === "confirmed";
  const railColor = STATUS_RAIL[booking.status];

  return (
    <article className="relative rounded-2xl border border-border bg-card overflow-hidden">
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", railColor)}
      />
      <div className="p-4 pl-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="text-center min-w-[3.5rem]">
            <p className="text-lg font-semibold text-foreground tabular-nums leading-none">
              {dt.toFormat("HH:mm")}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
              {end.toFormat("HH:mm")}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground truncate">
              {booking.service.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              with {booking.staffMember.displayName}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-border pt-3">
          <User className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate text-foreground">
            {booking.customer.firstName} {booking.customer.lastName}
          </span>
          {booking.customer.phone && (
            <a
              href={`tel:${booking.customer.phone}`}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary tabular-nums"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {booking.customer.phone}
            </a>
          )}
        </div>

        {modifiable && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={onReschedule}
            >
              Reschedule
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function Avatar({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return (
    <span
      aria-hidden
      className="grid place-items-center h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold"
    >
      {initials || "?"}
    </span>
  );
}

// ===========================================================================
// CONSTANTS / HELPERS
// ===========================================================================

const STATUS_RAIL: Record<BusinessBooking["status"], string> = {
  pending: "bg-warning",
  confirmed: "bg-success",
  completed: "bg-border",
  cancelled: "bg-border",
  no_show: "bg-destructive",
};

interface GroupedDay {
  key: string;
  label: string;
  sub: string;
  rows: BusinessBooking[];
}

function groupByDay(
  items: BusinessBooking[],
  timezone: string,
): GroupedDay[] {
  const now = DateTime.now().setZone(timezone);
  const today = now.toISODate();
  const tomorrow = now.plus({ days: 1 }).toISODate();
  const yesterday = now.minus({ days: 1 }).toISODate();
  const buckets = new Map<string, BusinessBooking[]>();
  for (const b of items) {
    const key = DateTime.fromISO(b.startAt, { zone: "utc" })
      .setZone(timezone)
      .toISODate();
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const dt = DateTime.fromISO(key, { zone: timezone }).setLocale("en-US");
      const label =
        key === today
          ? "Today"
          : key === tomorrow
            ? "Tomorrow"
            : key === yesterday
              ? "Yesterday"
              : dt.toFormat("cccc, LLL d");
      const sub = `${rows.length} booking${rows.length === 1 ? "" : "s"}`;
      return { key, label, sub, rows };
    });
}
