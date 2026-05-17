"use client";

import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";

export default function AdminOverview() {
  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.analytics(),
  });

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Aggregates across every tenant on the platform."
      />
      {analytics.isLoading && <Spinner />}
      {analytics.error instanceof ApiError && (
        <p className="text-sm text-destructive">
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-semibold text-foreground mt-1 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">{sub}</p>
      )}
    </div>
  );
}
