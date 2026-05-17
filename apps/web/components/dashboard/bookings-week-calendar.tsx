"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessBooking } from "@/lib/api/business";

// Visible window: 7am–10pm. A future enhancement could read venue hours
// from settings; for the redesign we picked a generous default that fits
// all the salon/barber profiles we've seen on the platform.
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const HOUR_HEIGHT_PX = 56;

export interface BookingsWeekCalendarProps {
  bookings: BusinessBooking[];
  timezone: string;
  /** Monday of the displayed week. Owned by the parent so the data query
   *  can fetch the matching range. */
  weekAnchor: DateTime;
  onWeekAnchorChange: (next: DateTime) => void;
  onSelect: (b: BusinessBooking) => void;
}

/**
 * Week-grid view of bookings — 7 day columns × hourly rail.
 *
 * Blocks are positioned absolute inside their day column using start/end
 * times converted to the tenant timezone. Colour comes from status; click
 * opens the parent's booking detail / reschedule flow.
 *
 * Layout choices that matter:
 *  • Hour rail is fixed-width on the left so the grid stays aligned at
 *    every breakpoint.
 *  • Below `sm`, the grid horizontally scrolls (min-width keeps each
 *    column comfortably tappable).
 *  • A live "now" indicator paints a 1px line across today's column so
 *    you can eyeball what's overdue.
 */
export function BookingsWeekCalendar({
  bookings,
  timezone,
  weekAnchor,
  onWeekAnchorChange,
  onSelect,
}: BookingsWeekCalendarProps) {
  // Tick once a minute so the "now" line stays accurate without thrashing.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekAnchor.plus({ days: i })),
    [weekAnchor],
  );
  const today = DateTime.now().setZone(timezone).startOf("day");
  const now = DateTime.fromMillis(nowTick).setZone(timezone);

  const byDay = useMemo(() => {
    const map = new Map<string, BusinessBooking[]>();
    for (const b of bookings) {
      const dt = DateTime.fromISO(b.startAt, { zone: "utc" }).setZone(timezone);
      const key = dt.toISODate();
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return map;
  }, [bookings, timezone]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <Toolbar
        weekAnchor={weekAnchor}
        timezone={timezone}
        onPrev={() => onWeekAnchorChange(weekAnchor.minus({ weeks: 1 }))}
        onNext={() => onWeekAnchorChange(weekAnchor.plus({ weeks: 1 }))}
        onToday={() =>
          onWeekAnchorChange(
            DateTime.now().setZone(timezone).startOf("week"),
          )
        }
      />

      <DayHeader days={days} today={today} />

      <div className="relative overflow-x-auto">
        <div className="grid grid-cols-[3.25rem_repeat(7,minmax(7rem,1fr))] sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <HourRail />
          {days.map((d) => {
            const key = d.toISODate()!;
            const dayBookings = byDay.get(key) ?? [];
            const isToday = d.hasSame(today, "day");
            const nowOffset =
              isToday &&
              now.hour + now.minute / 60 >= DAY_START_HOUR &&
              now.hour + now.minute / 60 < DAY_END_HOUR
                ? hourToTopPx(now.hour + now.minute / 60)
                : null;

            return (
              <div
                key={key}
                className={cn(
                  "relative border-r border-border last:border-r-0",
                  isToday && "bg-primary/[0.04]",
                )}
                style={{
                  height: (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX,
                }}
              >
                {hourSlots().map((h, idx) => (
                  <div
                    key={h}
                    aria-hidden
                    className={cn(
                      "absolute left-0 right-0 border-t border-border/70",
                      idx === 0 && "border-t-0",
                    )}
                    style={{ top: idx * HOUR_HEIGHT_PX }}
                  />
                ))}
                {nowOffset !== null && <NowLine top={nowOffset} />}
                {dayBookings.map((b) => (
                  <BookingBlock
                    key={b.id}
                    booking={b}
                    timezone={timezone}
                    onSelect={() => onSelect(b)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <Legend />
    </div>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function Toolbar({
  weekAnchor,
  timezone,
  onPrev,
  onNext,
  onToday,
}: {
  weekAnchor: DateTime;
  timezone: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const last = weekAnchor.plus({ days: 6 });
  const range =
    weekAnchor.month === last.month
      ? `${weekAnchor.toFormat("LLL d")} – ${last.toFormat("d, yyyy")}`
      : weekAnchor.year === last.year
        ? `${weekAnchor.toFormat("LLL d")} – ${last.toFormat("LLL d, yyyy")}`
        : `${weekAnchor.toFormat("LLL d, yyyy")} – ${last.toFormat("LLL d, yyyy")}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous week"
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday}>
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next week"
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm font-semibold text-foreground tabular-nums">
        {range}
      </p>
      <p className="hidden md:block text-xs text-muted-foreground tabular-nums">
        {timezone.replace(/_/g, " ")}
      </p>
    </div>
  );
}

function DayHeader({
  days,
  today,
}: {
  days: DateTime[];
  today: DateTime;
}) {
  return (
    <div className="grid grid-cols-[3.25rem_repeat(7,minmax(7rem,1fr))] sm:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/40">
      <div aria-hidden />
      {days.map((d) => {
        const isToday = d.hasSame(today, "day");
        return (
          <div
            key={d.toISODate()}
            className="px-2 py-2 text-center border-l border-border first:border-l-0"
          >
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium",
                isToday ? "text-primary" : "text-muted-foreground",
              )}
            >
              {d.toFormat("ccc")}
            </p>
            <p
              className={cn(
                "mt-0.5 inline-flex items-center justify-center rounded-full h-6 min-w-6 px-1.5 text-sm font-semibold tabular-nums",
                isToday
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground",
              )}
            >
              {d.toFormat("d")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function HourRail() {
  return (
    <div
      className="border-r border-border bg-muted/20"
      style={{ height: (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX }}
    >
      {hourSlots().map((h, idx) => (
        <div
          key={h}
          className="relative"
          style={{ height: HOUR_HEIGHT_PX }}
        >
          {idx > 0 && (
            <span className="absolute -top-1.5 right-1.5 text-[10px] tabular-nums text-muted-foreground">
              {String(h).padStart(2, "0")}:00
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function NowLine({ top }: { top: number }) {
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="relative">
        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
        <div className="h-px bg-destructive/80" />
      </div>
    </div>
  );
}

function BookingBlock({
  booking,
  timezone,
  onSelect,
}: {
  booking: BusinessBooking;
  timezone: string;
  onSelect: () => void;
}) {
  const start = DateTime.fromISO(booking.startAt, { zone: "utc" }).setZone(
    timezone,
  );
  const end = DateTime.fromISO(booking.endAt, { zone: "utc" }).setZone(
    timezone,
  );
  const startHrs = start.hour + start.minute / 60;
  const endHrs = end.hour + end.minute / 60;

  // Skip bookings entirely outside the visible window.
  if (endHrs <= DAY_START_HOUR || startHrs >= DAY_END_HOUR) return null;

  const top = hourToTopPx(Math.max(startHrs, DAY_START_HOUR));
  const bottom = hourToTopPx(Math.min(endHrs, DAY_END_HOUR));
  // 28px keeps a 15-minute block tappable AAA-compliantly (~44pt with padding).
  const height = Math.max(bottom - top, 28);
  const styles = STATUS_BLOCK_STYLES[booking.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group absolute left-1 right-1 rounded-lg px-2 py-1 text-left text-xs leading-tight overflow-hidden",
        "border transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        styles,
      )}
      style={{ top, height }}
      title={`${booking.service.name} — ${booking.customer.firstName} ${booking.customer.lastName}`}
    >
      <p className="font-semibold truncate">{booking.service.name}</p>
      <p className="truncate opacity-80">
        {booking.customer.firstName} {booking.customer.lastName}
      </p>
      {height >= 56 && (
        <p className="mt-0.5 text-[10px] tabular-nums opacity-70">
          {start.toFormat("HH:mm")} – {end.toFormat("HH:mm")}
        </p>
      )}
    </button>
  );
}

function Legend() {
  const items: Array<{ label: string; cls: string }> = [
    { label: "Confirmed", cls: "bg-success/20 border-success/50" },
    { label: "Pending", cls: "bg-warning/20 border-warning/50" },
    { label: "Completed", cls: "bg-muted border-border" },
    { label: "Cancelled", cls: "bg-muted/40 border-border" },
    { label: "No show", cls: "bg-destructive/15 border-destructive/40" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-t border-border bg-muted/20">
      {items.map((i) => (
        <span
          key={i.label}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span
            aria-hidden
            className={cn("h-3 w-3 rounded-sm border", i.cls)}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ===========================================================================
// CONSTANTS / HELPERS
// ===========================================================================

const STATUS_BLOCK_STYLES: Record<BusinessBooking["status"], string> = {
  pending:
    "bg-warning/15 border-warning/40 text-foreground hover:bg-warning/25",
  confirmed:
    "bg-success/15 border-success/40 text-foreground hover:bg-success/25",
  completed:
    "bg-muted border-border text-muted-foreground hover:bg-muted/80",
  cancelled:
    "bg-muted/40 border-border text-muted-foreground line-through hover:bg-muted/60",
  no_show:
    "bg-destructive/10 border-destructive/40 text-foreground hover:bg-destructive/15",
};

function hourSlots(): number[] {
  return Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => i + DAY_START_HOUR,
  );
}

function hourToTopPx(hours: number): number {
  return (hours - DAY_START_HOUR) * HOUR_HEIGHT_PX;
}
