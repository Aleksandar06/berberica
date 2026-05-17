"use client";

import { DateTime } from "luxon";
import {
  CheckCircle2,
  CircleCheck,
  MoreHorizontal,
  Phone,
  UserX,
} from "lucide-react";
import { useMemo } from "react";

import type { BusinessBooking } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

export interface TodayTimelineProps {
  bookings: BusinessBooking[];
  timezone: string;
  onMark: (
    booking: BusinessBooking,
    status: "confirmed" | "completed" | "no_show",
  ) => void;
  onCancel: (booking: BusinessBooking) => void;
  onReschedule: (booking: BusinessBooking) => void;
  marking: boolean;
}

/**
 * Vertical day-view of every booking on the current day, in start-time
 * order. Each row carries:
 *  • a status-coloured left rail (mirrors the week-calendar block colours)
 *  • the start/end time as a tabular-numeric column
 *  • customer + service summary
 *  • a chevron menu with arrived / no-show / reschedule / cancel
 *
 * Past-time rows are slightly faded so a glance at the page tells you
 * what's behind you vs. what's ahead.
 */
export function TodayTimeline({
  bookings,
  timezone,
  onMark,
  onCancel,
  onReschedule,
  marking,
}: TodayTimelineProps) {
  const { t } = useT();
  const sorted = useMemo(
    () => [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [bookings],
  );
  const now = DateTime.now().setZone(timezone);

  return (
    <ol className="space-y-2">
      {sorted.map((b) => {
        const start = DateTime.fromISO(b.startAt, { zone: "utc" }).setZone(
          timezone,
        );
        const end = DateTime.fromISO(b.endAt, { zone: "utc" }).setZone(
          timezone,
        );
        const inProgress = now >= start && now < end;
        const past = end < now;
        const railClass = STATUS_RAIL[b.status];
        const initials =
          `${b.customer.firstName[0] ?? ""}${b.customer.lastName[0] ?? ""}`.toUpperCase() ||
          "?";
        const modifiable =
          b.status === "pending" || b.status === "confirmed";

        return (
          <li key={b.id}>
            <article
              className={cn(
                "relative rounded-2xl border border-border bg-card overflow-hidden transition-colors",
                inProgress && "ring-1 ring-primary/40",
                past && "opacity-70",
              )}
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1", railClass)}
              />
              <div className="p-3 sm:p-4 pl-4 sm:pl-5 flex items-center gap-3">
                <div className="text-center min-w-[3rem] shrink-0">
                  <p className="text-base font-semibold text-foreground tabular-nums leading-none">
                    {start.toFormat("HH:mm")}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                    {end.toFormat("HH:mm")}
                  </p>
                </div>
                <span
                  aria-hidden
                  className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold"
                >
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">
                    {b.customer.firstName} {b.customer.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.service.name} · {b.staffMember.displayName}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {b.customer.phone && (
                    <a
                      href={`tel:${b.customer.phone}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary tabular-nums"
                      aria-label={`Call ${b.customer.firstName}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {b.customer.phone}
                    </a>
                  )}
                  <StatusBadge status={b.status} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {modifiable && (
                      <>
                        <DropdownMenuItem
                          disabled={marking || b.status === "confirmed"}
                          onSelect={() => onMark(b, "confirmed")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {t.today.markArrived}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={marking}
                          onSelect={() => onMark(b, "completed")}
                          className="text-success focus:text-success"
                        >
                          <CircleCheck className="h-4 w-4 mr-2" />
                          {t.today.markCompleted}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={marking}
                          onSelect={() => onMark(b, "no_show")}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          {t.today.markNoShow}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onReschedule(b)}>
                          {t.common.reschedule}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => onCancel(b)}
                        >
                          {t.today.cancelBookingButton}
                        </DropdownMenuItem>
                      </>
                    )}
                    {!modifiable && (
                      <DropdownMenuItem disabled>
                        No actions for {b.status} bookings
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS_RAIL: Record<BusinessBooking["status"], string> = {
  pending: "bg-warning",
  confirmed: "bg-success",
  completed: "bg-border",
  cancelled: "bg-border",
  no_show: "bg-destructive",
};
