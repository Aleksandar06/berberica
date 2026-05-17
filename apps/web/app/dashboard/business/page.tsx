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
import { useAuth } from "@/lib/auth/auth-context";
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
          ? "Marked arrived."
          : args.status === "no_show"
            ? "Marked as no-show."
            : "Marked completed.",
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
      toast.success("Booking cancelled.");
      void qc.invalidateQueries({ queryKey: ["business-bookings-today"] });
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function onMark(b: BusinessBooking, status: "confirmed" | "no_show") {
    if (status === "no_show") {
      const ok = await confirm({
        title: `Mark ${b.customer.firstName} as a no-show?`,
        description: "You can still cancel or reschedule them after.",
        confirmText: "Mark no-show",
        cancelText: "Back",
        tone: "destructive",
      });
      if (!ok) return;
    }
    setStatus.mutate({ id: b.id, status });
  }

  async function onCancel(b: BusinessBooking) {
    const ok = await confirm({
      title: "Cancel this booking?",
      description: `${b.service.name} for ${b.customer.firstName} ${b.customer.lastName}.`,
      confirmText: "Cancel booking",
      cancelText: "Keep it",
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
    if (!todays.data) return profile.data?.name ?? "Your business today.";
    if (items.length === 0) return "Nothing on the books for today.";
    const arrived = items.filter((b) => b.status === "confirmed").length;
    const noShows = items.filter((b) => b.status === "no_show").length;
    return (
      <span className="tabular-nums">
        <strong className="text-foreground font-semibold">{items.length}</strong>{" "}
        booked today
        <span className="text-border mx-2">·</span>
        <strong className="text-foreground font-semibold">{arrived}</strong>{" "}
        arrived
        {noShows > 0 && (
          <>
            <span className="text-border mx-2">·</span>
            <strong className="text-foreground font-semibold">{noShows}</strong>{" "}
            no-show
          </>
        )}
      </span>
    );
  }, [todays.data, items, profile.data?.name]);

  return (
    <>
      <PageHeader title="Today" description={description} />

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
              title="Quiet day"
              description="Nothing on the books — great moment to refill stock or take a break."
            />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  Today's schedule
                </h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {items.length} {items.length === 1 ? "booking" : "bookings"}
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

          {settings.data && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-3">
                Business at a glance
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Glance
                  label="Slot"
                  value={`${settings.data.defaultSlotDurationMinutes} min`}
                />
                <Glance
                  label="Lead time"
                  value={`${settings.data.bookingLeadTimeMinutes} min`}
                />
                <Glance
                  label="Max days ahead"
                  value={settings.data.bookingMaxDaysAhead}
                />
                <Glance
                  label="Guests"
                  value={
                    settings.data.allowGuestBooking ? "Allowed" : "Off"
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
            toast.success("Booking rescheduled.");
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
