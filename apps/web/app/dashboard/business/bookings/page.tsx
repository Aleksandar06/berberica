"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { CalendarDays, CalendarRange, List, X } from "lucide-react";
import { useMemo, useState } from "react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { BookingsListView } from "@/components/dashboard/bookings-list-view";
import { BookingsWeekCalendar } from "@/components/dashboard/bookings-week-calendar";
import { PageHeader } from "@/components/page-header";
import { RescheduleSheet } from "@/components/reschedule-sheet";
import { useAuth } from "@/lib/auth/auth-context";
import { useT } from "@/lib/i18n/language-context";
import { errorMessage, useToast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

interface ReschedulingTarget {
  id: string;
  serviceId: string;
  serviceName: string;
  staffMemberId: string;
  staffName: string;
}

type View = "list" | "calendar";

const TENANT_TIMEZONE = "Europe/Skopje"; // TODO: pull from profile when timezone-in-shell lands

export default function BusinessBookingsPage() {
  const { t } = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { memberships } = useAuth();
  const activeBusiness = memberships.find(
    (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
  );
  const tenantSlug = activeBusiness?.tenantSlug ?? "";

  const [view, setView] = useState<View>("list");
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    staffMemberId: "",
    status: "",
  });
  const [weekAnchor, setWeekAnchor] = useState<DateTime>(() =>
    DateTime.now().setZone(TENANT_TIMEZONE).startOf("week"),
  );
  const [rescheduling, setRescheduling] = useState<ReschedulingTarget | null>(
    null,
  );

  // Calendar view auto-derives its date window from the visible week, so
  // the query refetches whenever the user navigates. List view uses the
  // manual filter inputs.
  const effectiveDates = useMemo(() => {
    if (view === "calendar") {
      return {
        fromDate: weekAnchor.toISODate() ?? undefined,
        toDate: weekAnchor.plus({ days: 6 }).toISODate() ?? undefined,
      };
    }
    return {
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
    };
  }, [view, weekAnchor, filters.fromDate, filters.toDate]);

  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list(),
  });

  const bookings = useQuery({
    queryKey: [
      "business-bookings-list",
      effectiveDates,
      filters.staffMemberId,
      filters.status,
    ],
    queryFn: () =>
      businessApi.bookings.list({
        fromDate: effectiveDates.fromDate,
        toDate: effectiveDates.toDate,
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

  async function onCancel(b: BusinessBooking) {
    const ok = await confirm({
      title: "Cancel this booking?",
      description: "The customer will be notified (once notifications ship).",
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

  const items = bookings.data?.items ?? [];

  // Live counts for the description — gives the page a sense of pulse
  // without needing a separate "today" query.
  const counts = useMemo(() => summarise(items, TENANT_TIMEZONE), [items]);

  return (
    <>
      <PageHeader
        title={t.bookings.title}
        description={
          counts.total === 0 ? (
            t.bookings.descriptionEmpty
          ) : (
            <span className="tabular-nums">
              <strong className="text-foreground font-semibold">
                {counts.today}
              </strong>{" "}
              {t.bookings.todayCount}
              <span className="text-border mx-2">·</span>
              <strong className="text-foreground font-semibold">
                {counts.upcoming}
              </strong>{" "}
              {t.bookings.upcoming}
              <span className="text-border mx-2">·</span>
              <strong className="text-foreground font-semibold">
                {counts.total}
              </strong>{" "}
              {t.bookings.inView}
            </span>
          )
        }
        actions={<ViewToggle value={view} onChange={setView} />}
      />

      <FilterBar
        view={view}
        filters={filters}
        setFilters={setFilters}
        staff={staff.data ?? []}
      />

      {bookings.isLoading && <BookingsSkeleton view={view} />}

      {bookings.data && items.length === 0 && view === "list" && (
        <EmptyState
          icon={CalendarDays}
          title={t.bookings.noMatchTitle}
          description={t.bookings.noMatchBody}
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
              {t.bookings.filterClear}
            </Button>
          }
        />
      )}

      {!bookings.isLoading && view === "list" && items.length > 0 && (
        <BookingsListView
          bookings={items}
          timezone={TENANT_TIMEZONE}
          onCancel={onCancel}
          onReschedule={startReschedule}
        />
      )}

      {!bookings.isLoading && view === "calendar" && (
        <BookingsWeekCalendar
          bookings={items}
          timezone={TENANT_TIMEZONE}
          weekAnchor={weekAnchor}
          onWeekAnchorChange={setWeekAnchor}
          onSelect={startReschedule}
        />
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
          tenantTimezone={TENANT_TIMEZONE}
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
// VIEW TOGGLE
// ===========================================================================

function ViewToggle({
  value,
  onChange,
}: {
  value: View;
  onChange: (next: View) => void;
}) {
  const { t } = useT();
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as View)}>
      <TabsList className="h-10">
        <TabsTrigger value="list" className="gap-2">
          <List className="h-4 w-4" aria-hidden />
          {t.bookings.viewList}
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-2">
          <CalendarRange className="h-4 w-4" aria-hidden />
          {t.bookings.viewCalendar}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// ===========================================================================
// FILTER BAR
// ===========================================================================

function FilterBar({
  view,
  filters,
  setFilters,
  staff,
}: {
  view: View;
  filters: { fromDate: string; toDate: string; staffMemberId: string; status: string };
  setFilters: (next: typeof filters) => void;
  staff: { id: string; displayName: string }[];
}) {
  const hasActive =
    !!filters.fromDate ||
    !!filters.toDate ||
    !!filters.staffMemberId ||
    !!filters.status;

  function clear() {
    setFilters({ fromDate: "", toDate: "", staffMemberId: "", status: "" });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FilterField label="From">
          <Input
            type="date"
            value={filters.fromDate}
            disabled={view === "calendar"}
            onChange={(e) =>
              setFilters({ ...filters, fromDate: e.target.value })
            }
            className={cn(view === "calendar" && "opacity-60")}
          />
        </FilterField>
        <FilterField label="To">
          <Input
            type="date"
            value={filters.toDate}
            disabled={view === "calendar"}
            onChange={(e) =>
              setFilters({ ...filters, toDate: e.target.value })
            }
            className={cn(view === "calendar" && "opacity-60")}
          />
        </FilterField>
        <FilterField label="Staff">
          <Select
            value={filters.staffMemberId || "__all"}
            onValueChange={(v) =>
              setFilters({
                ...filters,
                staffMemberId: v === "__all" ? "" : v,
              })
            }
          >
            <SelectTrigger>
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
        </FilterField>
        <FilterField label="Status">
          <Select
            value={filters.status || "__any"}
            onValueChange={(v) =>
              setFilters({ ...filters, status: v === "__any" ? "" : v })
            }
          >
            <SelectTrigger>
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
        </FilterField>
      </div>

      {(hasActive || view === "calendar") && (
        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {view === "calendar"
              ? "Dates are driven by the calendar week — use the toolbar above the grid to navigate."
              : "Filters apply to both list and calendar views (date overrides for calendar)."}
          </p>
          {hasActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-muted-foreground"
            >
              <X className="h-3.5 w-3.5 mr-1" aria-hidden />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = label.toLowerCase();
  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

// ===========================================================================
// SKELETONS / SUMMARY HELPERS
// ===========================================================================

function BookingsSkeleton({ view }: { view: View }) {
  if (view === "calendar") {
    return <Skeleton className="h-[36rem] rounded-2xl" />;
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl md:h-14" />
      ))}
    </div>
  );
}

function summarise(items: BusinessBooking[], timezone: string) {
  const now = DateTime.now().setZone(timezone);
  const today = now.toISODate();
  let todayCount = 0;
  let upcoming = 0;
  for (const b of items) {
    const dt = DateTime.fromISO(b.startAt, { zone: "utc" }).setZone(timezone);
    if (dt.toISODate() === today) todayCount++;
    if (dt > now && (b.status === "pending" || b.status === "confirmed")) {
      upcoming++;
    }
  }
  return { today: todayCount, upcoming, total: items.length };
}
