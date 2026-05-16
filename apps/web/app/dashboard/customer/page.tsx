"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Calendar } from "lucide-react";
import { useState } from "react";

import { customerApi, type CustomerBooking } from "@/lib/api/customer";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

/**
 * Customer dashboard — lists this user's bookings across all tenants, and
 * lets them cancel or reschedule. Each booking carries its tenant slug + TZ
 * so the reschedule sheet can talk to the public availability endpoint
 * scoped to that tenant.
 */
export default function CustomerBookingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [rescheduling, setRescheduling] = useState<CustomerBooking | null>(null);

  const bookings = useQuery({
    queryKey: ["customer-bookings"],
    queryFn: () => customerApi.list(),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => customerApi.cancel(id),
    onSuccess: () => {
      toast.success("Booking cancelled.");
      void qc.invalidateQueries({ queryKey: ["customer-bookings"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "CANCELLATION_NOT_ALLOWED") {
        toast.error("This booking can no longer be cancelled online.");
      } else {
        toast.error(errorMessage(e));
      }
    },
  });

  async function onCancel(booking: CustomerBooking) {
    const ok = await confirm({
      title: "Cancel this booking?",
      description: `${booking.service.name} at ${booking.tenant.name}.`,
      confirmText: "Yes, cancel",
      cancelText: "Keep it",
      tone: "destructive",
    });
    if (ok) cancel.mutate(booking.id);
  }

  const now = DateTime.utc();
  const items = bookings.data ?? [];
  const upcoming = items
    .filter(
      (b) =>
        DateTime.fromISO(b.startAt) >= now &&
        b.status !== "cancelled" &&
        b.status !== "completed" &&
        b.status !== "no_show",
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const past = items
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));

  return (
    <>
      <PageHeading
        title="My bookings"
        description="Manage appointments you've booked across all venues."
      />

      {bookings.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {bookings.isError && (
        <p className="text-sm text-destructive">
          Could not load bookings: {errorMessage(bookings.error)}
        </p>
      )}

      {bookings.data && items.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No bookings yet"
          description="Once you book an appointment, it'll show up here so you can manage it."
        />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={() => onCancel(b)}
                onReschedule={() => setRescheduling(b)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Past & cancelled
          </h2>
          <div className="space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      {rescheduling && (
        <RescheduleSheet
          open={true}
          onOpenChange={(next) => !next && setRescheduling(null)}
          context={{
            serviceName: rescheduling.service.name,
            staffName: rescheduling.staffMember.displayName,
            tenantName: rescheduling.tenant.name,
          }}
          bookingId={rescheduling.id}
          tenantSlug={rescheduling.tenant.slug}
          tenantTimezone={rescheduling.tenant.timezone}
          serviceId={rescheduling.service.id}
          staffMemberId={rescheduling.staffMemberId}
          onSubmit={(newStartAt) =>
            customerApi.reschedule(rescheduling.id, newStartAt)
          }
          onSuccess={() => {
            toast.success("Booking rescheduled.");
            void qc.invalidateQueries({ queryKey: ["customer-bookings"] });
            setRescheduling(null);
          }}
        />
      )}
    </>
  );
}

function BookingCard({
  booking,
  onCancel,
  onReschedule,
}: {
  booking: CustomerBooking;
  onCancel?: () => void;
  onReschedule?: () => void;
}) {
  const tz = booking.tenant.timezone;
  const start = DateTime.fromISO(booking.startAt, { zone: "utc" }).setZone(tz);
  const end = DateTime.fromISO(booking.endAt, { zone: "utc" }).setZone(tz);
  const isModifiable =
    booking.status === "pending" || booking.status === "confirmed";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm transition hover:border-primary/30">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{booking.service.name}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {start.setLocale("en-US").toFormat("ccc, LLL d, yyyy · HH:mm")}–
          {end.toFormat("HH:mm")}{" "}
          <span className="text-muted-foreground/70">({tz})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {booking.tenant.name} · with {booking.staffMember.displayName}
        </p>
      </div>
      {(onCancel || onReschedule) && isModifiable && (
        <div className="flex gap-1 sm:flex-shrink-0">
          {onReschedule && (
            <Button variant="ghost" size="sm" onClick={onReschedule}>
              Reschedule
            </Button>
          )}
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
