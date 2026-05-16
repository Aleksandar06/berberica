"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";

import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useConfirm } from "@/components/confirm-dialog";
import { errorMessage, useToast } from "@/lib/ui/toast";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminTenantDetail({ params }: PageProps) {
  const { id } = use(params);
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const tenant = useQuery({
    queryKey: ["admin-tenant", id],
    queryFn: () => adminApi.getTenant(id),
  });

  const [form, setForm] = useState({
    name: "",
    businessType: "",
    timezone: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });

  // Sync form with fetched data.
  useEffect(() => {
    if (!tenant.data) return;
    setForm({
      name: tenant.data.name,
      businessType: tenant.data.businessType,
      timezone: tenant.data.timezone,
      contactEmail: tenant.data.contactEmail ?? "",
      contactPhone: tenant.data.contactPhone ?? "",
      address: tenant.data.address ?? "",
    });
  }, [tenant.data]);

  const update = useMutation({
    mutationFn: () =>
      adminApi.updateTenant(id, {
        name: form.name,
        businessType: form.businessType,
        timezone: form.timezone,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        address: form.address || null,
      }),
    onSuccess: () => {
      toast.success("Tenant updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-tenant", id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const suspend = useMutation({
    mutationFn: () => adminApi.suspendTenant(id),
    onSuccess: () => {
      toast.info("Tenant suspended.");
      void queryClient.invalidateQueries({ queryKey: ["admin-tenant", id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reactivate = useMutation({
    mutationFn: () => adminApi.reactivateTenant(id),
    onSuccess: () => {
      toast.success("Tenant reactivated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-tenant", id] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (tenant.isLoading) return <Spinner />;
  if (tenant.error instanceof ApiError)
    return (
      <p className="text-red-700 text-sm">
        Could not load tenant: {tenant.error.message}
      </p>
    );
  if (!tenant.data) return null;
  const t = tenant.data;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Tenants", href: "/dashboard/admin/tenants" },
          { label: t.name },
        ]}
        title={t.name}
        description={
          <>
            slug: <span className="font-mono">{t.slug}</span>
          </>
        }
        actions={<StatusBadge status={t.status} />}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate();
            }}
            className="rounded-lg border bg-white p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Core fields
            </h2>
            <Field
              id="name"
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <Field
              id="businessType"
              label="Business type"
              value={form.businessType}
              onChange={(v) => setForm({ ...form, businessType: v })}
            />
            <Field
              id="timezone"
              label="Timezone"
              value={form.timezone}
              onChange={(v) => setForm({ ...form, timezone: v })}
            />
            <Field
              id="contactEmail"
              label="Contact email"
              value={form.contactEmail}
              onChange={(v) => setForm({ ...form, contactEmail: v })}
            />
            <Field
              id="contactPhone"
              label="Contact phone"
              value={form.contactPhone}
              onChange={(v) => setForm({ ...form, contactPhone: v })}
            />
            <Field
              id="address"
              label="Address"
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Slug changes are intentionally disallowed — they would break
              every public URL pointing at this tenant.
            </p>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Lifecycle
            </h3>
            {t.status === "active" ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Suspend this tenant?",
                    description:
                      "Their public storefront will return a 403 until you reactivate them. Existing bookings stay intact.",
                    confirmText: "Suspend tenant",
                    tone: "destructive",
                  });
                  if (ok) suspend.mutate();
                }}
                disabled={suspend.isPending}
                loading={suspend.isPending}
              >
                Suspend
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => reactivate.mutate()}
                disabled={reactivate.isPending}
              >
                {reactivate.isPending ? "Reactivating…" : "Reactivate"}
              </Button>
            )}
            <p className="text-xs text-slate-500">
              Existing bookings are preserved either way. Suspended tenants
              just stop accepting new bookings (TENANT_SUSPENDED on the
              public API).
            </p>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700">Counts</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Users</dt>
              <dd className="text-right">{t._count.userRoles}</dd>
              <dt className="text-slate-500">Services</dt>
              <dd className="text-right">{t._count.services}</dd>
              <dt className="text-slate-500">Staff</dt>
              <dd className="text-right">{t._count.staffMembers}</dd>
              <dt className="text-slate-500">Bookings</dt>
              <dd className="text-right">{t._count.bookings}</dd>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
