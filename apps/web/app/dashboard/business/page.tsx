"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DateTime } from "luxon";

import { businessApi } from "@/lib/api/business";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";

export default function BusinessOverview() {
  const today = DateTime.now().toFormat("yyyy-LL-dd");
  const profile = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });
  const settings = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => businessApi.settings.get(),
  });
  const todays = useQuery({
    queryKey: ["business-bookings-today"],
    queryFn: () =>
      businessApi.bookings.list({
        fromDate: today,
        toDate: today,
        pageSize: 100,
      }),
  });

  return (
    <>
      <PageHeading
        title="Overview"
        description={profile.data?.name ?? "Your business at a glance."}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Today's bookings"
          value={todays.data?.items.length ?? "—"}
        />
        <Stat
          label="Slot duration"
          value={settings.data?.defaultSlotDurationMinutes ?? "—"}
          suffix="min"
        />
        <Stat
          label="Lead time"
          value={settings.data?.bookingLeadTimeMinutes ?? "—"}
          suffix="min"
        />
        <Stat
          label="Max days ahead"
          value={settings.data?.bookingMaxDaysAhead ?? "—"}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Today&apos;s schedule
          </h2>
          <Link
            href="/dashboard/business/bookings"
            className="text-sm text-blue-600 hover:underline"
          >
            All bookings →
          </Link>
        </div>
        {todays.isLoading && <Spinner />}
        {todays.data && todays.data.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Nothing on the books for today.
          </div>
        )}
        {todays.data && todays.data.items.length > 0 && (
          <ul className="rounded-lg border bg-white divide-y">
            {todays.data.items.map((b) => (
              <li
                key={b.id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {b.service.name} ·{" "}
                    <span className="text-slate-600 font-normal">
                      {b.staffMember.displayName}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {b.customer.firstName} {b.customer.lastName} · {b.customer.phone}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-slate-700">
                    {DateTime.fromISO(b.startAt).toFormat("HH:mm")}
                  </span>
                  <StatusBadge status={b.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">
        {value}
        {suffix && <span className="text-base text-slate-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
