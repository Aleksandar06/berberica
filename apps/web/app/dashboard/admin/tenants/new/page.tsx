"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { useToast, errorMessage } from "@/lib/ui/toast";

export default function NewTenantPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    businessType: "",
    timezone: "Europe/Skopje",
    contactEmail: "",
    contactPhone: "",
    address: "",
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
  });
  const [created, setCreated] = useState<{
    tenantId: string;
    initialPassword: string;
    adminEmail: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      adminApi.createTenant({
        name: form.name,
        slug: form.slug,
        businessType: form.businessType,
        timezone: form.timezone,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        address: form.address || undefined,
        adminEmail: form.adminEmail,
        adminFirstName: form.adminFirstName || undefined,
        adminLastName: form.adminLastName || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`Tenant "${res.tenant.name}" created.`);
      setCreated({
        tenantId: res.tenant.id,
        initialPassword: res.admin.initialPassword,
        adminEmail: res.admin.email,
      });
    },
    onError: (err) => {
      // Server returns structured Zod issues for validation failures;
      // surface them per-field when possible.
      if (
        err instanceof ApiError &&
        err.code === "VALIDATION_ERROR" &&
        Array.isArray(err.details)
      ) {
        const next: Record<string, string> = {};
        for (const issue of err.details as Array<{
          path: (string | number)[];
          message: string;
        }>) {
          const field = issue.path[0];
          if (typeof field === "string" && !next[field])
            next[field] = issue.message;
        }
        setFieldErrors(next);
      } else {
        toast.error(errorMessage(err));
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    create.mutate();
  }

  if (created) {
    return (
      <>
        <PageHeading
          title="Tenant created"
          description="Save this password — it's shown only once."
        />
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 space-y-3">
          <p className="text-sm text-amber-900">
            Send these credentials to the new tenant admin out-of-band. The
            password is NOT stored in plain text anywhere; we cannot show it
            again.
          </p>
          <dl className="text-sm grid sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-mono text-slate-900">{created.adminEmail}</dd>
            <dt className="text-slate-500">Initial password</dt>
            <dd className="font-mono text-slate-900 select-all">
              {created.initialPassword}
            </dd>
          </dl>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                router.push(`/dashboard/admin/tenants/${created.tenantId}`)
              }
            >
              Open tenant
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard/admin/tenants")}
            >
              Back to list
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title="Create a tenant"
        description="The new tenant gets a TENANT_ADMIN user — its initial password is shown ONCE on the next screen."
      />
      <form
        onSubmit={onSubmit}
        className="rounded-lg border bg-white p-6 space-y-5 max-w-3xl"
        noValidate
      >
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Business
          </h2>
          <Field
            id="name"
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            error={fieldErrors.name}
            required
          />
          <Field
            id="slug"
            label="Slug"
            description="lowercase, alphanumeric, may contain hyphens; never a reserved word"
            value={form.slug}
            onChange={(v) =>
              setForm({ ...form, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
            error={fieldErrors.slug}
            required
          />
          <Field
            id="businessType"
            label="Business type"
            value={form.businessType}
            onChange={(v) => setForm({ ...form, businessType: v })}
            error={fieldErrors.businessType}
            required
          />
          <Field
            id="timezone"
            label="Timezone (IANA)"
            value={form.timezone}
            onChange={(v) => setForm({ ...form, timezone: v })}
            error={fieldErrors.timezone}
            required
          />
          <Field
            id="contactEmail"
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(v) => setForm({ ...form, contactEmail: v })}
            error={fieldErrors.contactEmail}
          />
          <Field
            id="contactPhone"
            label="Contact phone (E.164)"
            placeholder="+38970000000"
            value={form.contactPhone}
            onChange={(v) => setForm({ ...form, contactPhone: v })}
            error={fieldErrors.contactPhone}
          />
          <Field
            id="address"
            label="Address"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
            error={fieldErrors.address}
          />
        </section>

        <section className="space-y-4 pt-2 border-t">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Initial tenant admin
          </h2>
          <Field
            id="adminEmail"
            label="Admin email"
            type="email"
            value={form.adminEmail}
            onChange={(v) => setForm({ ...form, adminEmail: v })}
            error={fieldErrors.adminEmail}
            required
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              id="adminFirstName"
              label="First name"
              value={form.adminFirstName}
              onChange={(v) => setForm({ ...form, adminFirstName: v })}
            />
            <Field
              id="adminLastName"
              label="Last name"
              value={form.adminLastName}
              onChange={(v) => setForm({ ...form, adminLastName: v })}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create tenant"}
          </Button>
        </div>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  description,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  required,
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
      {description && (
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      )}
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
