"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { adminApi, type TenantStatus } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";

export default function AdminTenantsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tenants", { search, status, page }],
    queryFn: () =>
      adminApi.listTenants({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  return (
    <>
      <PageHeading
        title="Tenants"
        description="Every business on the platform."
        actions={
          <Link href="/dashboard/admin/tenants/new" className="btn-primary">
            New tenant
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TenantStatus | "");
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading && (
          <div className="p-6">
            <Spinner />
          </div>
        )}
        {error instanceof ApiError && (
          <div className="p-6 text-sm text-red-700">
            Couldn&apos;t load tenants: {error.message}
          </div>
        )}
        {data && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">Name</th>
                <th className="text-left p-3 font-medium text-slate-700">Slug</th>
                <th className="text-left p-3 font-medium text-slate-700">Type</th>
                <th className="text-left p-3 font-medium text-slate-700">Timezone</th>
                <th className="text-left p-3 font-medium text-slate-700">Status</th>
                <th className="text-right p-3 font-medium text-slate-700">Open</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No tenants match.
                  </td>
                </tr>
              ) : (
                data.items.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-3 font-medium text-slate-900">{t.name}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">
                      {t.slug}
                    </td>
                    <td className="p-3 text-slate-600">{t.businessType}</td>
                    <td className="p-3 text-slate-600">{t.timezone}</td>
                    <td className="p-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/dashboard/admin/tenants/${t.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
