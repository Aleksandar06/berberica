"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Calendar, Repeat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { customerApi, type CustomerBooking } from "@/lib/api/customer";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { useT } from "@/lib/i18n/language-context";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { errorMessage, useToast } from "@/lib/ui/toast";

/**
 * Customer dashboard — lists this user's bookings across all tenants, and
 * lets them cancel or reschedule. Each booking carries its tenant slug + TZ
 * so the reschedule sheet can talk to the public availability endpoint
 * scoped to that tenant.
 */
export default function CustomerBookingsPage() {
  const { t } = useT();
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
      title: t.customer.cancelConfirmTitle,
      description: `${booking.service.name} — ${booking.tenant.name}.`,
      confirmText: t.customer.cancelConfirmYes,
      cancelText: t.customer.cancelConfirmNo,
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
      <PageHeader
        title={t.customer.title}
        description={
          bookings.data
            ? (() => {
                const upc = upcoming.length;
                const total = items.length;
                if (total === 0) {
                  return t.customer.descriptionEmpty;
                }
                return (
                  <span className="tabular-nums">
                    <strong className="text-foreground font-semibold">
                      {upc}
                    </strong>{" "}
                    {t.common.upcoming}
                    <span className="text-border mx-2">·</span>
                    <strong className="text-foreground font-semibold">
                      {total - upc}
                    </strong>{" "}
                    {t.common.past}
                  </span>
                );
              })()
            : t.customer.descriptionEmpty
        }
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
          title={t.customer.noBookingsTitle}
          description={t.customer.noBookingsBody}
        />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.customer.upcoming}
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
            {t.customer.pastCancelled}
          </h2>
          <div className="space-y-3">
            {past.map((b) => (
              <BookingCard key={b.id} booking={b} showRebook />
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
  showRebook = false,
}: {
  booking: CustomerBooking;
  onCancel?: () => void;
  onReschedule?: () => void;
  /** Show a "Rebook" deep-link — used on past/cancelled cards. */
  showRebook?: boolean;
}) {
  const { t, locale } = useT();
  const tz = booking.tenant.timezone;
  const start = DateTime.fromISO(booking.startAt, { zone: "utc" }).setZone(tz);
  const end = DateTime.fromISO(booking.endAt, { zone: "utc" }).setZone(tz);
  const isModifiable =
    booking.status === "pending" || booking.status === "confirmed";
  const initials =
    `${booking.staffMember.displayName[0] ?? ""}`.toUpperCase() || "?";
  // Deep link back to the booking flow with this service + staff pre-selected.
  // Hits the existing query-param contract — no backend change.
  const rebookHref = `/${booking.tenant.slug}/book?serviceId=${encodeURIComponent(
    booking.service.id,
  )}&staffId=${encodeURIComponent(booking.staffMemberId)}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm transition hover:border-primary/30">
      <span
        aria-hidden
        className="hidden sm:grid place-items-center h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary text-sm font-semibold"
      >
        {initials}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">{booking.service.name}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {start.setLocale(locale).toFormat("ccc, LLL d, yyyy · HH:mm")}–
          {end.toFormat("HH:mm")}{" "}
          <span className="text-muted-foreground/70">({tz})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {booking.tenant.name} · {booking.staffMember.displayName}
        </p>
      </div>
      {((onCancel || onReschedule) && isModifiable) || showRebook ? (
        <div className="flex gap-1 sm:flex-shrink-0">
          {showRebook && (
            <Button
              asChild
              variant="secondary"
              size="sm"
              leadingIcon={<Repeat className="h-3.5 w-3.5" />}
            >
              <Link href={rebookHref}>{t.customer.rebook}</Link>
            </Button>
          )}
          {onReschedule && isModifiable && (
            <Button variant="ghost" size="sm" onClick={onReschedule}>
              {t.common.reschedule}
            </Button>
          )}
          {onCancel && isModifiable && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onCancel}
            >
              {t.common.cancel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
