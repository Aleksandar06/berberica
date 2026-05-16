"use client";

import { DateTime } from "luxon";
import { Calendar, Clock, User } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BookingSummaryCardProps {
  serviceName: string;
  durationMinutes: number;
  staffName: string;
  /** UTC ISO instant of the slot start. */
  startUtc: string;
  /** Display string already formatted in tenant TZ. */
  displayTime: string;
  timezone: string;
  className?: string;
}

/**
 * Sticky summary card surfaced from the "details" stage onward — it
 * reassures the customer about what they're booking and what their
 * commitment is right up to the final tap.
 */
export function BookingSummaryCard({
  serviceName,
  durationMinutes,
  staffName,
  startUtc,
  displayTime,
  timezone,
  className,
}: BookingSummaryCardProps) {
  const dt = DateTime.fromISO(startUtc, { zone: "utc" })
    .setZone(timezone)
    .setLocale("en-US");
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-accent/40 p-4 sm:p-5 space-y-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Your appointment
        </p>
        <span className="text-xs font-medium text-muted-foreground">
          {durationMinutes} min
        </span>
      </div>
      <p className="text-h3 text-foreground">{serviceName}</p>
      <div className="flex flex-col gap-1.5 text-sm text-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>{dt.toFormat("ccc, LLL d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="tabular-nums">{displayTime}</span>
          <span className="text-xs text-muted-foreground">({timezone})</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>with {staffName}</span>
        </div>
      </div>
    </div>
  );
}
