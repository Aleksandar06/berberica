"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

import { businessApi, type BusinessBooking } from "@/lib/api/business";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { NextUpCard } from "@/components/dashboard/next-up-card";
import { PageHeader } from "@/components/page-header";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayQuickActions } from "@/components/dashboard/today-quick-actions";
import { TodayTimeline } from "@/components/dashboard/today-timeline";
import { formatMoney } from "@/lib/format/money";
import { useAuth } from "@/lib/auth/auth-context";
import { useT } from "@/lib/i18n/language-context";
import { errorMessage, useToast } from "@/lib/ui/toast";

const TENANT_TIMEZONE = "Europe/Skopje"; // TODO: pull from profile when timezone-in-shell lands

interface ReschedulingTarget {
  id: string;
  serviceId: string;
  serviceName: string;
  staffMemberId: string;
  staffName: string;
}

/**
 * Today page — rebuilt around the question "who's next?".
 *
 * Layout (top → bottom):
 *   1. NextUpCard            — live clock + soonest pending booking with
 *                              one-tap arrived / no-show + quick-call.
 *   2. TodayQuickActions     — add walk-in, view week, block time.
 *   3. TodayTimeline         — every booking today, status-rail rows.
 *   4. Business at a glance  — compact stats (slot duration, lead time...)
 *                              demoted from hero to a single-line footer
 *                              because they don't change per shift.
 */
export default function BusinessOverview() {
  const { t } = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { memberships } = useAuth();
  const activeBusiness = memberships.find(
    (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
  );
  const tenantSlug = activeBusiness?.tenantSlug ?? "";

  const todayIso = DateTime.now().setZone(TENANT_TIMEZONE).toISODate() ?? "";

  const profile = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });
  const settings = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => businessApi.settings.get(),
  });
  const todays = useQuery({
    queryKey: ["business-bookings-today", todayIso],
    queryFn: () =>
      businessApi.bookings.list({
        fromDate: todayIso,
        toDate: todayIso,
        pageSize: 100,
      }),
  });
  const earnings = useQuery({
    queryKey: ["business-earnings-today", todayIso],
    queryFn: () =>
      businessApi.analytics.earnings({ from: todayIso, to: todayIso }),
  });

  const [rescheduling, setRescheduling] = useState<ReschedulingTarget | null>(
    null,
  );

  const setStatus = useMutation({
    mutationFn: (args: {
      id: string;
      status: "confirmed" | "completed" | "no_show";
    }) => businessApi.bookings.setStatus(args.id, args.status),
    onSuccess: (_, args) => {
      toast.success(
        args.status === "confirmed"
          ? t.today.markedArrived
          : args.status === "no_show"
            ? t.today.markedNoShow
            : t.today.markedCompleted,
      );
      void qc.invalidateQueries({ queryKey: ["business-bookings-today"] });
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      businessApi.bookings.cancel(id, "Cancelled by admin"),
    onSuccess: () => {
      toast.success(t.today.bookingCancelled);
      void qc.invalidateQueries({ queryKey: ["business-bookings-today"] });
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function onMark(
    b: BusinessBooking,
    status: "confirmed" | "completed" | "no_show",
  ) {
    if (status === "no_show") {
      const ok = await confirm({
        title: t.today.noShowConfirmTitle(b.customer.firstName),
        description: t.today.noShowConfirmBody,
        confirmText: t.today.noShowConfirmYes,
        cancelText: t.today.noShowConfirmNo,
        tone: "destructive",
      });
      if (!ok) return;
    }
    setStatus.mutate({ id: b.id, status });
  }

  async function onCancel(b: BusinessBooking) {
    const ok = await confirm({
      title: t.today.cancelConfirmTitle,
      description: t.today.cancelConfirmBody(
        b.service.name,
        `${b.customer.firstName} ${b.customer.lastName}`,
      ),
      confirmText: t.today.cancelBookingButton,
      cancelText: t.today.keepBookingButton,
      tone: "destructive",
    });
    if (ok) cancel.mutate(b.id);
  }

  function startReschedule(b: BusinessBooking) {
    setRescheduling({
      id: b.id,
      serviceId: b.service.id,
      serviceName: b.service.name,
      staffMemberId: b.staffMember.id,
      staffName: b.staffMember.displayName,
    });
  }

  const items = todays.data?.items ?? [];
  const upcoming = useMemo(
    () =>
      items
        .filter((b) => b.status === "pending" || b.status === "confirmed")
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [items],
  );

  const description = useMemo(() => {
    if (!todays.data) return profile.data?.name ?? t.today.descriptionEmpty;
    if (items.length === 0) return t.today.nothingBooked;
    const arrived = items.filter((b) => b.status === "confirmed").length;
    const noShows = items.filter((b) => b.status === "no_show").length;
    return (
      <span className="tabular-nums">
        <strong className="text-foreground font-semibold">{items.length}</strong>{" "}
        {t.today.bookedToday}
        <span className="text-border mx-2">·</span>
        <strong className="text-foreground font-semibold">{arrived}</strong>{" "}
        {t.today.arrived}
        {noShows > 0 && (
          <>
            <span className="text-border mx-2">·</span>
            <strong className="text-foreground font-semibold">{noShows}</strong>{" "}
            {t.today.noShows}
          </>
        )}
      </span>
    );
  }, [todays.data, items, profile.data?.name, t]);

  return (
    <>
      <PageHeader title={t.today.title} description={description} />

      {todays.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      )}

      {todays.data && (
        <>
          <NextUpCard
            upcoming={upcoming}
            timezone={TENANT_TIMEZONE}
            onMark={onMark}
            marking={setStatus.isPending}
          />

          <TodayQuickActions />

          {items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={t.today.quietDayTitle}
              description={t.today.quietDayBody}
            />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  {t.today.schedule}
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {items.length} {t.common.bookings(items.length)}
                </span>
              </div>
              <TodayTimeline
                bookings={items}
                timezone={TENANT_TIMEZONE}
                onMark={onMark}
                onCancel={onCancel}
                onReschedule={startReschedule}
                marking={setStatus.isPending}
              />
            </section>
          )}

          {earnings.data &&
            (earnings.data.totals.earned.cents > 0 ||
              earnings.data.totals.projected.cents > 0) && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-3">
                  {t.today.earningsCardTitle}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Glance
                    label={t.today.earned}
                    value={formatMoney(
                      earnings.data.totals.earned.cents,
                      earnings.data.currency,
                    )}
                  />
                  <Glance
                    label={t.today.projected}
                    value={formatMoney(
                      earnings.data.totals.projected.cents,
                      earnings.data.currency,
                    )}
                  />
                </dl>
              </section>
            )}

          {settings.data && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-3">
                {t.today.glanceTitle}
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Glance
                  label={t.today.glanceSlot}
                  value={`${settings.data.defaultSlotDurationMinutes} ${t.common.min}`}
                />
                <Glance
                  label={t.today.glanceLeadTime}
                  value={`${settings.data.bookingLeadTimeMinutes} ${t.common.min}`}
                />
                <Glance
                  label={t.today.glanceMaxDays}
                  value={settings.data.bookingMaxDaysAhead}
                />
                <Glance
                  label={t.today.glanceGuests}
                  value={
                    settings.data.allowGuestBooking
                      ? t.today.glanceGuestsAllowed
                      : t.today.glanceGuestsOff
                  }
                />
              </dl>
            </section>
          )}
        </>
      )}

      {rescheduling && tenantSlug && (
        <RescheduleSheet
          open={true}
          onOpenChange={(next) => !next && setRescheduling(null)}
          context={{
            serviceName: rescheduling.serviceName,
            staffName: rescheduling.staffName,
            tenantName: profile.data?.name ?? "this venue",
          }}
          bookingId={rescheduling.id}
          tenantSlug={tenantSlug}
          tenantTimezone={TENANT_TIMEZONE}
          serviceId={rescheduling.serviceId}
          staffMemberId={rescheduling.staffMemberId}
          onSubmit={(newStartAt) =>
            businessApi.bookings.reschedule(rescheduling.id, newStartAt)
          }
          onSuccess={() => {
            toast.success(t.today.bookingRescheduled);
            void qc.invalidateQueries({
              queryKey: ["business-bookings-today"],
            });
            void qc.invalidateQueries({
              queryKey: ["business-bookings-list"],
            });
            setRescheduling(null);
          }}
        />
      )}
    </>
  );
}

function Glance({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}
