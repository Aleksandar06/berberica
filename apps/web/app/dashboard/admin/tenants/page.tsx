"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { adminApi, type TenantStatus } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/dashboard/page-heading";
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
          <Button asChild leadingIcon={<Plus />}>
            <Link href="/dashboard/admin/tenants/new">New tenant</Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={status || "__all"}
          onValueChange={(v) => {
            setStatus(v === "__all" ? "" : (v as TenantStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <TenantsSkeleton />}
      {error instanceof ApiError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load tenants: {error.message}
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No tenants match"
          description="Try adjusting your search or status filter."
        />
      )}

      {/* MOBILE: card list */}
      {data && data.items.length > 0 && (
        <ul className="space-y-2 md:hidden">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/admin/tenants/${t.id}`}
                className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-semibold text-foreground truncate">
                        {t.name}
                      </p>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {t.slug}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.businessType} · {t.timezone}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 text-muted-foreground shrink-0 mt-1"
                    aria-hidden
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* DESKTOP: table */}
      {data && data.items.length > 0 && (
        <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-foreground">Name</th>
                <th className="text-left p-3 font-medium text-foreground">Slug</th>
                <th className="text-left p-3 font-medium text-foreground">Type</th>
                <th className="text-left p-3 font-medium text-foreground">Timezone</th>
                <th className="text-left p-3 font-medium text-foreground">Status</th>
                <th className="text-right p-3 font-medium text-foreground">Open</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-foreground">{t.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {t.slug}
                  </td>
                  <td className="p-3 text-muted-foreground">{t.businessType}</td>
                  <td className="p-3 text-muted-foreground">{t.timezone}</td>
                  <td className="p-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/dashboard/admin/tenants/${t.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
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

function TenantsSkeleton() {
  return (
    <div className="space-y-2 md:rounded-2xl md:border md:border-border md:bg-card md:overflow-hidden md:space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-24 rounded-2xl md:rounded-none md:h-12 md:border-b md:last:border-0"
        />
      ))}
    </div>
  );
}
