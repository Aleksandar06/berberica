"use client";

import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";

export default function AdminOverview() {
  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.analytics(),
  });

  return (
    <>
      <PageHeading
        title="Platform overview"
        description="Aggregates across every tenant on the platform."
      />
      {analytics.isLoading && <Spinner />}
      {analytics.error instanceof ApiError && (
        <p className="text-sm text-red-700">
          Could not load analytics: {analytics.error.message}
        </p>
      )}
      {analytics.data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Tenants"
            value={analytics.data.tenants.total}
            sub={`${analytics.data.tenants.active} active · ${analytics.data.tenants.suspended} suspended`}
          />
          <Stat label="Users" value={analytics.data.users.total} />
          <Stat label="Services" value={analytics.data.services.total} />
          <Stat label="Staff" value={analytics.data.staff.total} />
          <Stat
            label="Bookings"
            value={analytics.data.bookings.total}
            sub={Object.entries(analytics.data.bookings.byStatus)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          />
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
