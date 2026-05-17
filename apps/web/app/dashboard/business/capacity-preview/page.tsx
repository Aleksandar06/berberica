"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { businessApi, type CapacityPreview } from "@/lib/api/business";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Spinner } from "@/components/ui/spinner";

export default function CapacityPreviewPage() {
  const services = useQuery({
    queryKey: ["business-services"],
    queryFn: () => businessApi.services.list({ isActive: true }),
  });
  const staff = useQuery({
    queryKey: ["business-staff"],
    queryFn: () => businessApi.staff.list({ isActive: true }),
  });

  const [form, setForm] = useState({
    staffMemberId: "",
    serviceId: "",
    date: "",
    mode: "theoretical" as "theoretical" | "real_day",
  });

  const preview = useMutation({
    mutationFn: () =>
      businessApi.availability.capacityPreview({
        staffMemberId: form.staffMemberId,
        serviceId: form.serviceId,
        date: form.date,
        mode: form.mode,
      }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.staffMemberId && form.serviceId && form.date) {
      preview.mutate();
    }
  }

  return (
    <>
      <PageHeader
        title="Capacity preview"
        description="Shows how a day would look — both the storefront slot grid AND the actual packing capacity."
      />

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
      >
        <div>
          <Label htmlFor="staff">Staff</Label>
          <select
            id="staff"
            value={form.staffMemberId}
            onChange={(e) =>
              setForm({ ...form, staffMemberId: e.target.value })
            }
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Select…</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="service">Service</Label>
          <select
            id="service"
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Select…</option>
            {services.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.durationMinutes}m)
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="mode">Mode</Label>
          <select
            id="mode"
            value={form.mode}
            onChange={(e) =>
              setForm({
                ...form,
                mode: e.target.value as "theoretical" | "real_day",
              })
            }
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="theoretical">Theoretical</option>
            <option value="real_day">Real day</option>
          </select>
        </div>
        <Button type="submit" disabled={preview.isPending}>
          {preview.isPending ? "Computing…" : "Run preview"}
        </Button>
      </form>

      {preview.isPending && <Spinner label="Computing capacity…" />}
      {preview.error instanceof ApiError && (
        <p className="text-sm text-red-700">{preview.error.message}</p>
      )}
      {preview.data && <CapacityResult result={preview.data} />}
    </>
  );
}

function CapacityResult({ result }: { result: CapacityPreview }) {
  return (
    <div className="space-y-6">
      {/* Headline — drive home that the two numbers are different things. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Visible start times
          </p>
          <p className="text-4xl font-semibold text-slate-900 mt-1">
            {result.validStartTimes.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Slot-grid positions that pass every check (window fit, breaks,
            existing bookings). This is what customers see on the storefront.
          </p>
        </div>
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-700">
            Max non-overlapping bookings
          </p>
          <p className="text-4xl font-semibold text-emerald-900 mt-1">
            {result.maxNonOverlappingBookings}
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            How many bookings could actually fit if you packed the day
            perfectly. Driven by service duration + buffers, NOT slot duration.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat
          label="Working minutes"
          value={result.workingMinutes}
        />
        <Stat label="Break minutes" value={result.breakMinutes} />
        <Stat
          label="Net bookable minutes"
          value={result.netBookableMinutes}
        />
        <Stat label="Slot duration" value={result.slotDurationMinutes} suffix="min" />
        <Stat
          label="Service duration"
          value={result.serviceDurationMinutes}
          suffix="min"
        />
        <Stat
          label="Possible slot starts"
          value={result.possibleStartTimes.length}
        />
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Warnings
          </p>
          <ul className="text-sm text-amber-900 list-disc pl-5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.suggestions.length > 0 && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
            Suggestions
          </p>
          <ul className="text-sm text-blue-900 list-disc pl-5">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Valid start times ({result.validStartTimes.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {result.validStartTimes.map((t) => (
              <span
                key={t}
                className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-mono"
              >
                {t}
              </span>
            ))}
            {result.validStartTimes.length === 0 && (
              <span className="text-xs text-slate-500">None.</span>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Invalid ({result.invalidStartTimes.length})
          </p>
          <ul className="text-sm space-y-1">
            {result.invalidStartTimes.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-mono text-red-700">{r.time}</span>
                <span className="text-slate-600">— {r.reason}</span>
              </li>
            ))}
            {result.invalidStartTimes.length === 0 && (
              <li className="text-xs text-slate-500">None.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">
        {value}
        {suffix && <span className="text-sm text-slate-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}
