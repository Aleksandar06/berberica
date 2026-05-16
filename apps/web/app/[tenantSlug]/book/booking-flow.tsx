"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/public";
import type {
  PublicAvailabilitySlot,
  PublicService,
  PublicStaffMember,
} from "@/lib/api/types";
import {
  dateInZonePlusDays,
  todayInZone,
} from "@/lib/format/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  guestCustomerSchema,
  type GuestCustomerInput,
} from "@scheduling/schemas";

const ANY_STAFF_ID = "any" as const;

interface Props {
  tenantSlug: string;
  tenantTimezone: string;
  services: PublicService[];
  staff: PublicStaffMember[];
  preselectedServiceId?: string;
}

type Stage =
  | "pick-service"
  | "pick-staff"
  | "pick-slot"
  | "guest-details"
  | "verify-otp"
  | "submitting"
  | "confirmed";

interface BookingDraft {
  service: PublicService;
  staffId: string; // uuid or ANY_STAFF_ID
  date: string;
  slot: PublicAvailabilitySlot;
  guest?: GuestCustomerInput;
  grantToken?: string;
}

/**
 * The booking flow is a small client-side state machine. Each stage either
 * renders an input UI or kicks off an async request and advances.
 *
 * Verification fits into the flow as its own stage (`verify-otp`) right
 * before submission — Step 11A's gate. A registered customer would skip
 * straight from `guest-details` to submission; that path lands when login
 * UI arrives in Step 13.
 *
 * Source of truth for availability is always the backend — we re-fetch
 * after every slot pick and on every 409 SLOT_TAKEN.
 */
export function BookingFlow({
  tenantSlug,
  tenantTimezone,
  services,
  staff,
  preselectedServiceId,
}: Props) {
  const queryClient = useQueryClient();
  const initialService =
    services.find((s) => s.id === preselectedServiceId) ?? null;

  const [stage, setStage] = useState<Stage>(
    initialService ? "pick-staff" : "pick-service",
  );
  const [service, setService] = useState<PublicService | null>(initialService);
  const [staffId, setStaffId] = useState<string>(ANY_STAFF_ID);
  const [date, setDate] = useState<string>(() => todayInZone(tenantTimezone));
  const [selectedSlot, setSelectedSlot] =
    useState<PublicAvailabilitySlot | null>(null);
  const [guestDetails, setGuestDetails] = useState<GuestCustomerInput | null>(
    null,
  );
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    startAt: string;
    serviceName: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const eligibleStaff = useMemo(
    () =>
      service
        ? staff.filter((s) => s.serviceIds.includes(service.id))
        : staff,
    [service, staff],
  );

  // -------------------------------------------------------------------------
  // Availability query — only enabled when we have everything we need.
  // -------------------------------------------------------------------------
  const availability = useQuery({
    queryKey: [
      "availability",
      tenantSlug,
      service?.id,
      staffId,
      date,
    ],
    enabled: service !== null && stage === "pick-slot",
    queryFn: () =>
      publicApi.getAvailability(tenantSlug, {
        serviceId: service!.id,
        staffId,
        date,
      }),
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const otpRequest = useMutation({
    mutationFn: () => {
      if (!service || !selectedSlot || !guestDetails?.email) {
        throw new Error("Missing fields for OTP request");
      }
      return publicApi.requestOtp(tenantSlug, {
        email: guestDetails.email,
        serviceId: service.id,
        staffId,
        startAt: selectedSlot.startUtc,
      });
    },
  });
  const otpConfirm = useMutation({
    mutationFn: (code: string) => {
      if (!service || !selectedSlot || !guestDetails?.email) {
        throw new Error("Missing fields for OTP confirm");
      }
      return publicApi.confirmOtp(tenantSlug, {
        email: guestDetails.email,
        code,
        serviceId: service.id,
        staffId,
        startAt: selectedSlot.startUtc,
      });
    },
    onSuccess: (res) => {
      setGrantToken(res.grantToken);
      void submitBooking(res.grantToken);
    },
  });
  const createBooking = useMutation({
    mutationFn: (args: { grantToken: string }) => {
      if (!service || !selectedSlot || !guestDetails) {
        throw new Error("Booking not ready");
      }
      return publicApi.createBooking(tenantSlug, {
        mode: "guest",
        serviceId: service.id,
        staffId,
        startAt: selectedSlot.startUtc,
        guest: guestDetails,
        verificationGrant: args.grantToken,
      });
    },
    onSuccess: (res) => {
      setConfirmation({
        id: res.bookingId,
        startAt: res.startAt,
        serviceName: service?.name ?? "",
      });
      setStage("confirmed");
    },
    onError: (err) => {
      // Friendly handling for the "slot just taken" 409 — refetch slots,
      // bounce the user back to the picker; the grant survives so they
      // can pick a new slot and the next submit re-uses it.
      if (
        err instanceof ApiError &&
        (err.code === "SLOT_TAKEN" || err.code === "SLOT_UNAVAILABLE")
      ) {
        setSubmitError(
          "That time was just taken by another booking. Please pick another slot.",
        );
        setStage("pick-slot");
        setSelectedSlot(null);
        void queryClient.invalidateQueries({
          queryKey: ["availability", tenantSlug, service?.id, staffId, date],
        });
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        setSubmitError(
          "Too many requests — please wait a moment and try again.",
        );
        setStage("guest-details");
        return;
      }
      setSubmitError(
        err instanceof Error ? err.message : "Could not complete the booking.",
      );
    },
  });

  function submitBooking(token: string) {
    setStage("submitting");
    createBooking.mutate({ grantToken: token });
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  if (stage === "confirmed" && confirmation) {
    return (
      <Confirmation
        tenantSlug={tenantSlug}
        tenantTimezone={tenantTimezone}
        startAtUtc={confirmation.startAt}
        serviceName={confirmation.serviceName}
        bookingId={confirmation.id}
      />
    );
  }

  return (
    <div className="space-y-6">
      <StageTracker current={stage} />

      {submitError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {submitError}
        </div>
      )}

      {stage === "pick-service" && (
        <ServicePicker
          services={services}
          onPick={(s) => {
            setService(s);
            setStage("pick-staff");
          }}
        />
      )}

      {stage === "pick-staff" && service && (
        <StaffPicker
          service={service}
          staff={eligibleStaff}
          selected={staffId}
          onPick={(id) => {
            setStaffId(id);
            setStage("pick-slot");
          }}
          onBack={() => setStage("pick-service")}
        />
      )}

      {stage === "pick-slot" && service && (
        <SlotPicker
          tenantTimezone={tenantTimezone}
          date={date}
          onChangeDate={(d) => {
            setDate(d);
            setSelectedSlot(null);
          }}
          loading={availability.isLoading}
          error={availability.error}
          slots={availability.data?.slots ?? []}
          selected={selectedSlot?.startUtc ?? null}
          onPick={(slot) => {
            setSelectedSlot(slot);
            setStage("guest-details");
          }}
          onBack={() => setStage("pick-staff")}
        />
      )}

      {stage === "guest-details" && service && selectedSlot && (
        <GuestDetailsForm
          tenantTimezone={tenantTimezone}
          serviceName={service.name}
          slot={selectedSlot}
          initial={guestDetails}
          onBack={() => setStage("pick-slot")}
          onContinue={(g) => {
            setGuestDetails(g);
            setSubmitError(null);
            // If we already have a grant from a prior submission (e.g. after
            // a 409 retry on a new slot), skip OTP and go straight to submit.
            if (grantToken) {
              submitBooking(grantToken);
              return;
            }
            setStage("verify-otp");
            otpRequest.mutate();
          }}
        />
      )}

      {stage === "verify-otp" && guestDetails && (
        <OtpVerify
          email={guestDetails.email!}
          isRequesting={otpRequest.isPending}
          isConfirming={otpConfirm.isPending}
          requestError={otpRequest.error}
          confirmError={otpConfirm.error}
          onResend={() => otpRequest.mutate()}
          onSubmit={(code) => {
            setSubmitError(null);
            otpConfirm.mutate(code);
          }}
          onBack={() => setStage("guest-details")}
        />
      )}

      {stage === "submitting" && (
        <div className="rounded-lg border bg-white p-8 text-center">
          <Spinner label="Confirming your booking…" />
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

const STAGE_LABELS: Record<Stage, string> = {
  "pick-service": "Service",
  "pick-staff": "Staff",
  "pick-slot": "Time",
  "guest-details": "Your details",
  "verify-otp": "Verify email",
  submitting: "Confirming",
  confirmed: "Done",
};
const STAGE_ORDER: Stage[] = [
  "pick-service",
  "pick-staff",
  "pick-slot",
  "guest-details",
  "verify-otp",
  "confirmed",
];

function StageTracker({ current }: { current: Stage }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STAGE_ORDER.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <li
            key={s}
            className="flex items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={
                done
                  ? "h-6 w-6 rounded-full grid place-items-center brand-bg text-xs"
                  : active
                    ? "h-6 w-6 rounded-full grid place-items-center text-xs border-2"
                    : "h-6 w-6 rounded-full grid place-items-center text-xs border border-slate-300 text-slate-400"
              }
              style={
                active
                  ? { borderColor: "var(--brand-primary)", color: "var(--brand-primary)" }
                  : undefined
              }
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={
                active ? "font-semibold text-slate-900" : "text-slate-500"
              }
            >
              {STAGE_LABELS[s]}
            </span>
            {i < STAGE_ORDER.length - 1 && (
              <span className="text-slate-300" aria-hidden>›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ServicePicker({
  services,
  onPick,
}: {
  services: PublicService[];
  onPick: (s: PublicService) => void;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
        No services available yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Choose a service</h2>
      <ul className="grid sm:grid-cols-2 gap-3">
        {services.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 transition"
            >
              <div className="flex justify-between items-start gap-3">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="text-xs rounded bg-slate-100 px-2 py-1">
                  {s.durationMinutes} min
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-slate-600 mt-2">{s.description}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffPicker({
  service,
  staff,
  selected,
  onPick,
  onBack,
}: {
  service: PublicService;
  staff: PublicStaffMember[];
  selected: string;
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Choose a staff member</h2>
        <button onClick={onBack} className="text-sm text-slate-500 hover:underline">
          ← Back
        </button>
      </div>
      <p className="text-sm text-slate-600">
        For <span className="font-medium">{service.name}</span>
      </p>
      <ul className="grid sm:grid-cols-2 gap-3">
        <li>
          <StaffCard
            label="Any available"
            sub="We&apos;ll pick whoever is free at your chosen time"
            active={selected === ANY_STAFF_ID}
            onClick={() => onPick(ANY_STAFF_ID)}
          />
        </li>
        {staff.map((s) => (
          <li key={s.id}>
            <StaffCard
              label={s.displayName}
              sub="Specific staff member"
              active={selected === s.id}
              onClick={() => onPick(s.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StaffCard({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border bg-white p-4 transition ${
        active
          ? "border-2"
          : "border border-slate-200 hover:border-slate-400"
      }`}
      style={active ? { borderColor: "var(--brand-primary)" } : undefined}
    >
      <div className="font-semibold text-slate-900">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </button>
  );
}

function SlotPicker({
  tenantTimezone,
  date,
  onChangeDate,
  loading,
  error,
  slots,
  selected,
  onPick,
  onBack,
}: {
  tenantTimezone: string;
  date: string;
  onChangeDate: (d: string) => void;
  loading: boolean;
  error: unknown;
  slots: PublicAvailabilitySlot[];
  selected: string | null;
  onPick: (slot: PublicAvailabilitySlot) => void;
  onBack: () => void;
}) {
  const today = todayInZone(tenantTimezone);
  const maxDate = dateInZonePlusDays(tenantTimezone, 60);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Pick a date and time</h2>
        <button onClick={onBack} className="text-sm text-slate-500 hover:underline">
          ← Back
        </button>
      </div>

      <div>
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          value={date}
          min={today}
          max={maxDate}
          onChange={(e) => onChangeDate(e.target.value)}
        />
        <p className="text-xs text-slate-500 mt-1">
          Times shown in {tenantTimezone}.
        </p>
      </div>

      {loading && <Spinner label="Loading available times…" />}
      {error instanceof ApiError && (
        <p className="text-sm text-red-700">Could not load times: {error.message}</p>
      )}
      {!loading && !error && slots.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 text-sm">
          No openings on this date. Try another.
        </div>
      )}

      {slots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {slots.map((s) => {
            const isSel = s.startUtc === selected;
            return (
              <button
                key={s.startUtc}
                onClick={() => onPick(s)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  isSel
                    ? "border-2 brand-bg"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
                style={isSel ? { borderColor: "var(--brand-primary)" } : undefined}
              >
                {s.displayTime}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GuestDetailsForm({
  tenantTimezone,
  serviceName,
  slot,
  initial,
  onBack,
  onContinue,
}: {
  tenantTimezone: string;
  serviceName: string;
  slot: PublicAvailabilitySlot;
  initial: GuestCustomerInput | null;
  onBack: () => void;
  onContinue: (g: GuestCustomerInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GuestCustomerInput>({
    resolver: zodResolver(guestCustomerSchema),
    defaultValues: initial ?? undefined,
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!data.email) {
          // Step 11A requires email for the OTP step; surface clearly.
          return;
        }
        onContinue(data);
      })}
      className="space-y-4"
      noValidate
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Your details</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back
        </button>
      </div>

      <p className="text-sm text-slate-600">
        Booking <span className="font-medium">{serviceName}</span> at{" "}
        <span className="font-medium">{slot.displayTime}</span>{" "}
        <span className="text-slate-500">({tenantTimezone})</span>
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-red-700 mt-1">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          {errors.lastName && (
            <p className="text-xs text-red-700 mt-1">{errors.lastName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">
            Phone <span className="text-slate-400">(with country code)</span>
          </Label>
          <Input
            id="phone"
            placeholder="+38970555100"
            autoComplete="tel"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-red-700 mt-1">{errors.phone.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
          <p className="text-xs text-slate-500 mt-1">
            We&apos;ll send a 6-digit code to verify your address.
          </p>
          {errors.email && (
            <p className="text-xs text-red-700 mt-1">{errors.email.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="note">
            Note <span className="text-slate-400">(optional)</span>
          </Label>
          <textarea
            id="note"
            rows={3}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 brand-ring"
            {...register("note")}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          Continue
        </Button>
      </div>
    </form>
  );
}

function OtpVerify({
  email,
  isRequesting,
  isConfirming,
  requestError,
  confirmError,
  onResend,
  onSubmit,
  onBack,
}: {
  email: string;
  isRequesting: boolean;
  isConfirming: boolean;
  requestError: unknown;
  confirmError: unknown;
  onResend: () => void;
  onSubmit: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const confirmErrorMessage =
    confirmError instanceof ApiError ? confirmError.message : null;
  const requestErrorMessage =
    requestError instanceof ApiError ? requestError.message : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) onSubmit(code);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Verify your email</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back
        </button>
      </div>
      <p className="text-sm text-slate-600">
        We sent a 6-digit code to <span className="font-medium">{email}</span>.
        Enter it below to finish your booking.
      </p>

      <div>
        <Label htmlFor="code">Verification code</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          className="tracking-[0.5em] text-center text-lg"
        />
        {confirmErrorMessage && (
          <p className="text-xs text-red-700 mt-1">{confirmErrorMessage}</p>
        )}
      </div>

      {requestErrorMessage && (
        <p className="text-xs text-amber-700">
          Couldn&apos;t send code: {requestErrorMessage}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onResend}
          disabled={isRequesting}
          className="text-sm text-slate-600 hover:underline disabled:opacity-50"
        >
          {isRequesting ? "Sending…" : "Resend code"}
        </button>
        <Button
          type="submit"
          disabled={code.length !== 6 || isConfirming}
        >
          {isConfirming ? "Verifying…" : "Verify & book"}
        </Button>
      </div>
    </form>
  );
}

function Confirmation({
  tenantSlug,
  tenantTimezone,
  startAtUtc,
  serviceName,
  bookingId,
}: {
  tenantSlug: string;
  tenantTimezone: string;
  startAtUtc: string;
  serviceName: string;
  bookingId: string;
}) {
  // Format the confirmation time in the tenant's TZ so the customer sees
  // what the shop sees.
  const startLocal = useMemo(
    () =>
      new Date(startAtUtc).toLocaleString("en-US", {
        timeZone: tenantTimezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [startAtUtc, tenantTimezone],
  );
  return (
    <div className="rounded-lg border bg-white p-8 text-center space-y-4">
      <div className="mx-auto h-14 w-14 rounded-full grid place-items-center brand-bg">
        <span className="text-2xl" aria-hidden>
          ✓
        </span>
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">
        You&apos;re booked
      </h2>
      <p className="text-slate-700">
        <span className="font-medium">{serviceName}</span> · {startLocal}{" "}
        <span className="text-slate-500">({tenantTimezone})</span>
      </p>
      <p className="text-xs text-slate-400">Reference: {bookingId}</p>
      <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={`/${tenantSlug}`} className="btn-secondary">
          Back to home
        </Link>
        <Link href={`/${tenantSlug}/book`} className="btn-primary">
          Book another
        </Link>
      </div>
    </div>
  );
}
