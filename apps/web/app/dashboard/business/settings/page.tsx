"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { businessApi } from "@/lib/api/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/page-heading";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/lib/ui/toast";

export default function BusinessSettingsPage() {
  return (
    <>
      <PageHeading
        title="Settings"
        description="Business profile, booking policy, and brand colors."
      />
      <div className="space-y-8">
        <ProfileCard />
        <SettingsCard />
        <BrandingCard />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------

function ProfileCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-profile"],
    queryFn: () => businessApi.profile.get(),
  });
  const [form, setForm] = useState({
    name: "",
    businessType: "",
    timezone: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name,
        businessType: q.data.businessType,
        timezone: q.data.timezone,
        contactEmail: q.data.contactEmail ?? "",
        contactPhone: q.data.contactPhone ?? "",
        address: q.data.address ?? "",
      });
    }
  }, [q.data]);
  const update = useMutation({
    mutationFn: () =>
      businessApi.profile.update({
        name: form.name,
        businessType: form.businessType,
        timezone: form.timezone,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        address: form.address || null,
      }),
    onSuccess: () => {
      toast.success("Profile updated.");
      void qc.invalidateQueries({ queryKey: ["business-profile"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Spinner />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate();
      }}
      className="rounded-lg border bg-white p-6 space-y-4"
    >
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
        Profile
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
        label="Timezone (IANA)"
        value={form.timezone}
        onChange={(v) => setForm({ ...form, timezone: v })}
      />
      <Field
        id="contactEmail"
        label="Contact email"
        type="email"
        value={form.contactEmail}
        onChange={(v) => setForm({ ...form, contactEmail: v })}
      />
      <Field
        id="contactPhone"
        label="Contact phone (E.164)"
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
          {update.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

function SettingsCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-settings"],
    queryFn: () => businessApi.settings.get(),
  });
  const [form, setForm] = useState({
    defaultSlotDurationMinutes: 15,
    bookingLeadTimeMinutes: 0,
    bookingMaxDaysAhead: 60,
    allowGuestBooking: true,
    allowCustomerCancellation: true,
    cancellationCutoffMinutes: 120,
    allowCustomerReschedule: true,
    rescheduleCutoffMinutes: 120,
    requireVerifiedAccountForBooking: false,
  });
  useEffect(() => {
    if (!q.data) return;
    setForm({
      defaultSlotDurationMinutes: q.data.defaultSlotDurationMinutes,
      bookingLeadTimeMinutes: q.data.bookingLeadTimeMinutes,
      bookingMaxDaysAhead: q.data.bookingMaxDaysAhead,
      allowGuestBooking: q.data.allowGuestBooking,
      allowCustomerCancellation: q.data.allowCustomerCancellation,
      cancellationCutoffMinutes: q.data.cancellationCutoffMinutes,
      allowCustomerReschedule: q.data.allowCustomerReschedule,
      rescheduleCutoffMinutes: q.data.rescheduleCutoffMinutes,
      requireVerifiedAccountForBooking: q.data.requireVerifiedAccountForBooking,
    });
  }, [q.data]);
  const update = useMutation({
    mutationFn: () => businessApi.settings.update(form),
    onSuccess: () => {
      toast.success("Settings updated.");
      void qc.invalidateQueries({ queryKey: ["business-settings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Spinner />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate();
      }}
      className="rounded-lg border bg-white p-6 space-y-4"
    >
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
        Booking policy
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="slot">Default slot duration</Label>
          <select
            id="slot"
            value={form.defaultSlotDurationMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                defaultSlotDurationMinutes: Number(e.target.value),
              })
            }
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {SLOT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </div>
        <NumberField
          id="lead"
          label="Lead time (min)"
          value={form.bookingLeadTimeMinutes}
          onChange={(v) => setForm({ ...form, bookingLeadTimeMinutes: v })}
        />
        <NumberField
          id="max"
          label="Max days ahead"
          value={form.bookingMaxDaysAhead}
          onChange={(v) => setForm({ ...form, bookingMaxDaysAhead: v })}
        />
        <NumberField
          id="cancel-cut"
          label="Cancellation cutoff (min)"
          value={form.cancellationCutoffMinutes}
          onChange={(v) => setForm({ ...form, cancellationCutoffMinutes: v })}
        />
        <NumberField
          id="resched-cut"
          label="Reschedule cutoff (min)"
          value={form.rescheduleCutoffMinutes}
          onChange={(v) => setForm({ ...form, rescheduleCutoffMinutes: v })}
        />
      </div>
      <Checkbox
        label="Allow guest booking"
        value={form.allowGuestBooking}
        onChange={(v) => setForm({ ...form, allowGuestBooking: v })}
      />
      <Checkbox
        label="Allow customer cancellation"
        value={form.allowCustomerCancellation}
        onChange={(v) => setForm({ ...form, allowCustomerCancellation: v })}
      />
      <Checkbox
        label="Allow customer reschedule"
        value={form.allowCustomerReschedule}
        onChange={(v) => setForm({ ...form, allowCustomerReschedule: v })}
      />
      <Checkbox
        label="Require verified account for booking"
        value={form.requireVerifiedAccountForBooking}
        onChange={(v) =>
          setForm({ ...form, requireVerifiedAccountForBooking: v })
        }
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// BRANDING
// ---------------------------------------------------------------------------

function BrandingCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["business-branding"],
    queryFn: () => businessApi.branding.get(),
  });
  const [form, setForm] = useState({
    logoUrl: "",
    primaryColor: "#0f172a",
    secondaryColor: "#3b82f6",
    accentColor: "#f59e0b",
  });
  useEffect(() => {
    if (q.data) {
      setForm({
        logoUrl: q.data.logoUrl ?? "",
        primaryColor: q.data.primaryColor ?? "#0f172a",
        secondaryColor: q.data.secondaryColor ?? "#3b82f6",
        accentColor: q.data.accentColor ?? "#f59e0b",
      });
    }
  }, [q.data]);
  const update = useMutation({
    mutationFn: () =>
      businessApi.branding.update({
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor || null,
        secondaryColor: form.secondaryColor || null,
        accentColor: form.accentColor || null,
      }),
    onSuccess: () => {
      toast.success("Branding updated.");
      void qc.invalidateQueries({ queryKey: ["business-branding"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Spinner />;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate();
      }}
      className="rounded-lg border bg-white p-6 space-y-4"
    >
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
        Branding
      </h2>
      <Field
        id="logoUrl"
        label="Logo URL"
        description="Direct file upload lands in the storage step. For now, paste any image URL."
        value={form.logoUrl}
        onChange={(v) => setForm({ ...form, logoUrl: v })}
      />
      <div className="grid sm:grid-cols-3 gap-4">
        <ColorField
          id="primary"
          label="Primary"
          value={form.primaryColor}
          onChange={(v) => setForm({ ...form, primaryColor: v })}
        />
        <ColorField
          id="secondary"
          label="Secondary"
          value={form.secondaryColor}
          onChange={(v) => setForm({ ...form, secondaryColor: v })}
        />
        <ColorField
          id="accent"
          label="Accent"
          value={form.accentColor}
          onChange={(v) => setForm({ ...form, accentColor: v })}
        />
      </div>
      <div className="rounded-md border bg-slate-50 p-4">
        <p className="text-xs text-slate-500 mb-2">Preview</p>
        <div
          className="rounded-md p-4 text-white"
          style={{ background: form.primaryColor }}
        >
          Your storefront header looks like this.
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// PRIMITIVES
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  description,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && (
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Checkbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function ColorField({
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
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-slate-300 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
