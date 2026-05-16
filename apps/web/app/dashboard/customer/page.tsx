"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useState } from "react";

import { customerApi, type CustomerBooking } from "@/lib/api/customer";
import { publicApi } from "@/lib/api/public";
import type { PublicAvailabilitySlot } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import {
  dateInZonePlusDays,
  todayInZone,
} from "@/lib/format/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PageHeading } from "@/components/dashboard/page-heading";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

/**
 * Customer dashboard — lists this user's bookings across all tenants, and
 * lets them cancel or reschedule. Each booking carries its tenant slug + TZ
 * so we can talk to the public availability endpoint scoped to that tenant.
 */
export default function CustomerBookingsPage() {
  const toast = useToast();
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

      {bookings.isLoading && <Spinner />}
      {bookings.isError && (
        <p className="text-sm text-red-700">
          Could not load bookings: {errorMessage(bookings.error)}
        </p>
      )}

      {bookings.data && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          You don&apos;t have any bookings yet.
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={() => {
                  if (window.confirm("Cancel this booking?")) {
                    cancel.mutate(b.id);
                  }
                }}
                onReschedule={() => setRescheduling(b)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
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
        <RescheduleDialog
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onSuccess={() => {
            setRescheduling(null);
            toast.success("Booking rescheduled.");
            void qc.invalidateQueries({ queryKey: ["customer-bookings"] });
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

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
    <div className="rounded-lg border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900">{booking.service.name}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-slate-600">
          {start.setLocale("en-US").toFormat("ccc, LLL d, yyyy · HH:mm")}
          {"–"}
          {end.toFormat("HH:mm")}{" "}
          <span className="text-slate-400">({tz})</span>
        </p>
        <p className="text-xs text-slate-500">
          {booking.tenant.name} · with {booking.staffMember.displayName}
        </p>
      </div>
      {(onCancel || onReschedule) && isModifiable && (
        <div className="flex gap-3 sm:flex-shrink-0">
          {onReschedule && (
            <button
              type="button"
              onClick={onReschedule}
              className="text-sm text-blue-600 hover:underline"
            >
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-red-700 hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reschedule dialog: tenant-scoped availability picker, then POSTs to the
// customer reschedule endpoint. The backend re-runs the slot check inside
// SERIALIZABLE + the exclusion constraint, so a stale slot raises 409 here.
// ---------------------------------------------------------------------------

function RescheduleDialog({
  booking,
  onClose,
  onSuccess,
}: {
  booking: CustomerBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const tz = booking.tenant.timezone;
  const [date, setDate] = useState<string>(() => todayInZone(tz));
  const [pickedSlot, setPickedSlot] = useState<PublicAvailabilitySlot | null>(
    null,
  );

  const availability = useQuery({
    queryKey: [
      "customer-reschedule-availability",
      booking.tenant.slug,
      booking.service.id,
      booking.staffMemberId,
      date,
    ],
    queryFn: () =>
      publicApi.getAvailability(booking.tenant.slug, {
        serviceId: booking.service.id,
        staffId: booking.staffMemberId,
        date,
      }),
  });

  const reschedule = useMutation({
    mutationFn: (newStartAt: string) =>
      customerApi.reschedule(booking.id, newStartAt),
    onSuccess,
    onError: (e) => {
      if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE") {
        toast.error("That slot is no longer available.");
        void availability.refetch();
        setPickedSlot(null);
      } else if (e instanceof ApiError && e.code === "SLOT_TAKEN") {
        toast.error("That slot was just taken — please pick another.");
        void availability.refetch();
        setPickedSlot(null);
      } else if (
        e instanceof ApiError &&
        e.code === "RESCHEDULE_NOT_ALLOWED"
      ) {
        toast.error("This booking can no longer be rescheduled online.");
      } else {
        toast.error(errorMessage(e));
      }
    },
  });

  const today = todayInZone(tz);
  const maxDate = dateInZonePlusDays(tz, 60);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reschedule booking"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Reschedule booking
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {booking.service.name} with {booking.staffMember.displayName} at{" "}
                {booking.tenant.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div>
            <Label htmlFor="reschedule-date">New date</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              min={today}
              max={maxDate}
              onChange={(e) => {
                setDate(e.target.value);
                setPickedSlot(null);
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              Times shown in {tz}.
            </p>
          </div>

          {availability.isLoading && <Spinner label="Loading times…" />}
          {availability.isError && (
            <p className="text-sm text-red-700">
              Could not load times: {errorMessage(availability.error)}
            </p>
          )}
          {availability.data && availability.data.slots.length === 0 && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No openings on this date. Try another.
            </div>
          )}

          {availability.data && availability.data.slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {availability.data.slots.map((s) => {
                const isSel = pickedSlot?.startUtc === s.startUtc;
                return (
                  <button
                    key={s.startUtc}
                    type="button"
                    onClick={() => setPickedSlot(s)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      isSel
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    {s.displayTime}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={reschedule.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pickedSlot || reschedule.isPending}
              onClick={() => {
                if (pickedSlot) reschedule.mutate(pickedSlot.startUtc);
              }}
            >
              {reschedule.isPending ? "Rescheduling…" : "Confirm new time"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
