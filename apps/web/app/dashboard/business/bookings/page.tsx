"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { CalendarDays, User } from "lucide-react";
import { useState } from "react";

import { businessApi, type BusinessBooking } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useAuth } from "@/lib/auth/auth-context";
import { errorMessage, useToast } from "@/lib/ui/toast";

interface ReschedulingTarget {
  id: string;
  serviceId: string;
  serviceName: string;
  staffMemberId: string;
  staffName: string;
}

export default function BusinessBookingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { memberships } = useAuth();
  const activeBusiness = memberships.find(
    (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
  );
  const tenantSlug = activeBusiness?.tenantSlug ?? "";
  const tenantTimezone = "Europe/Skopje"; // TODO: pull from profile when timezone-in-shell lands

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    staffMemberId: "",
    status: "",
  });
  const [rescheduling, setRescheduling] = useState<ReschedulingTarget | null>(null);

  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list(),
  });
  const bookings = useQuery({
    queryKey: ["business-bookings-list", filters],
    queryFn: () =>
      businessApi.bookings.list({
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        staffMemberId: filters.staffMemberId || undefined,
        status: filters.status || undefined,
        pageSize: 100,
      }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      businessApi.bookings.cancel(id, "Cancelled by admin"),
    onSuccess: () => {
      toast.success("Booking cancelled.");
      void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function onCancel(bookingId: string) {
    const ok = await confirm({
      title: "Cancel this booking?",
      description: "The customer will be notified (once notifications ship).",
      confirmText: "Cancel booking",
      cancelText: "Keep it",
      tone: "destructive",
    });
    if (ok) cancel.mutate(bookingId);
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

  const items = bookings.data?.items ?? [];
  const grouped = groupByDay(items, tenantTimezone);

  return (
    <>
      <PageHeading
        title="Bookings"
        description="All confirmed and historical bookings for this tenant."
      />

      <FilterRow
        filters={filters}
        setFilters={setFilters}
        staff={staff.data ?? []}
      />

      {bookings.isLoading && <BookingsSkeleton />}

      {bookings.data && items.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No bookings match"
          description="Try widening the date range or clearing filters."
          action={
            <Button
              variant="secondary"
              onClick={() =>
                setFilters({
                  fromDate: "",
                  toDate: "",
                  staffMemberId: "",
                  status: "",
                })
              }
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* MOBILE: grouped card list */}
      {items.length > 0 && (
        <div className="space-y-6 md:hidden">
          {grouped.map(({ key, label, rows }) => (
            <section key={key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                {label}
              </h2>
              <div className="space-y-2">
                {rows.map((b) => (
                  <BookingMobileCard
                    key={b.id}
                    booking={b}
                    timezone={tenantTimezone}
                    onCancel={() => onCancel(b.id)}
                    onReschedule={() => startReschedule(b)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* DESKTOP: data table */}
      {items.length > 0 && (
        <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-foreground">When</th>
                <th className="text-left p-3 font-medium text-foreground">Service</th>
                <th className="text-left p-3 font-medium text-foreground">Staff</th>
                <th className="text-left p-3 font-medium text-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="p-3 whitespace-nowrap font-mono text-xs text-foreground tabular-nums">
                    {DateTime.fromISO(b.startAt).toFormat("yyyy-LL-dd HH:mm")}
                  </td>
                  <td className="p-3">{b.service.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {b.staffMember.displayName}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">
                      {b.customer.firstName} {b.customer.lastName}
                    </p>
                    {b.customer.phone && (
                      <p className="text-xs text-muted-foreground">
                        {b.customer.phone}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="p-3 text-right">
                    {(b.status === "pending" || b.status === "confirmed") && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startReschedule(b)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => onCancel(b.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rescheduling && tenantSlug && (
        <RescheduleSheet
          open={true}
          onOpenChange={(next) => !next && setRescheduling(null)}
          context={{
            serviceName: rescheduling.serviceName,
            staffName: rescheduling.staffName,
            tenantName: "this venue",
          }}
          bookingId={rescheduling.id}
          tenantSlug={tenantSlug}
          tenantTimezone={tenantTimezone}
          serviceId={rescheduling.serviceId}
          staffMemberId={rescheduling.staffMemberId}
          onSubmit={(newStartAt) =>
            businessApi.bookings.reschedule(rescheduling.id, newStartAt)
          }
          onSuccess={() => {
            toast.success("Booking rescheduled.");
            void qc.invalidateQueries({ queryKey: ["business-bookings-list"] });
            setRescheduling(null);
          }}
        />
      )}
    </>
  );
}

// ===========================================================================
// FILTER ROW
// ===========================================================================

function FilterRow({
  filters,
  setFilters,
  staff,
}: {
  filters: { fromDate: string; toDate: string; staffMemberId: string; status: string };
  setFilters: (next: typeof filters) => void;
  staff: { id: string; displayName: string }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="staff">Staff</Label>
        <Select
          value={filters.staffMemberId || "__all"}
          onValueChange={(v) =>
            setFilters({ ...filters, staffMemberId: v === "__all" ? "" : v })
          }
        >
          <SelectTrigger id="staff">
            <SelectValue placeholder="All staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All staff</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={filters.status || "__any"}
          onValueChange={(v) =>
            setFilters({ ...filters, status: v === "__any" ? "" : v })
          }
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any">Any</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_show">No show</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
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
  const dt = DateTime.fromISO(booking.startAt, { zone: "utc" }).setZone(timezone);
  const modifiable = booking.status === "pending" || booking.status === "confirmed";
  return (
    <article className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground truncate">
            {booking.service.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {dt.toFormat("ccc, LLL d · HH:mm")}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" aria-hidden />
        <span className="truncate">
          {booking.customer.firstName} {booking.customer.lastName}
          <span className="text-muted-foreground/70"> · {booking.staffMember.displayName}</span>
        </span>
      </div>
      {booking.customer.phone && (
        <a
          href={`tel:${booking.customer.phone}`}
          className="block text-xs font-medium text-primary"
        >
          {booking.customer.phone}
        </a>
      )}
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
            className="flex-1 text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </article>
  );
}

// ===========================================================================
// HELPERS
// ===========================================================================

function BookingsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl md:h-14" />
      ))}
    </div>
  );
}

interface GroupedDay {
  key: string;
  label: string;
  rows: BusinessBooking[];
}

function groupByDay(items: BusinessBooking[], timezone: string): GroupedDay[] {
  const now = DateTime.now().setZone(timezone);
  const today = now.toISODate();
  const tomorrow = now.plus({ days: 1 }).toISODate();
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
            : dt.toFormat("cccc, LLL d");
      return { key, label, rows };
    });
}
