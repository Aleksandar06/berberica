"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/public";
import type {
  PublicAvailabilitySlot,
  PublicService,
  PublicStaffMember,
} from "@/lib/api/types";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AddToCalendarButtons } from "@/components/booking/add-to-calendar";
import { BookingSummaryCard } from "@/components/booking/booking-summary-card";
import { DateStrip } from "@/components/booking/date-strip";
import { OtpInput } from "@/components/booking/otp-input";
import { SlotList } from "@/components/booking/slot-list";
import { StageProgress } from "@/components/booking/stage-progress";
import {
  dateInZonePlusDays,
  todayInZone,
} from "@/lib/format/time";
import { cn } from "@/lib/utils";
import {
  guestCustomerSchema,
  type GuestCustomerInput,
} from "@scheduling/schemas";

const ANY_STAFF_ID = "any" as const;

interface Props {
  tenantSlug: string;
  tenantName: string;
  tenantTimezone: string;
  services: PublicService[];
  staff: PublicStaffMember[];
  preselectedServiceId?: string;
  /**
   * Deep-link staff selection — used by the customer dashboard's "Rebook"
   * button to skip the staff picker and land directly on date/time.
   * Falls back to "any available" when the staff id no longer exists.
   */
  preselectedStaffId?: string;
}

type Stage =
  | "pick-service"
  | "pick-staff"
  | "pick-time"
  | "details"
  | "verify-otp"
  | "submitting"
  | "confirmed";

const STAGES_FOR_PROGRESS: Stage[] = [
  "pick-service",
  "pick-staff",
  "pick-time",
  "details",
  "verify-otp",
];
const STAGE_LABELS: Record<Stage, string> = {
  "pick-service": "Service",
  "pick-staff": "Staff",
  "pick-time": "Time",
  details: "Details",
  "verify-otp": "Verify",
  submitting: "Booking",
  confirmed: "Done",
};

/**
 * Public booking flow — mobile-first, Treatwell-inspired.
 *
 * The flow is a client-side state machine. Each stage renders a single
 * sub-screen with a sticky bottom CTA and a back button in the header.
 * Source of truth for availability is always the backend — we re-fetch
 * on every date/slot change and on every 409 SLOT_TAKEN, then bounce the
 * user back to the picker with a friendly message.
 */
export function BookingFlow({
  tenantSlug,
  tenantName,
  tenantTimezone,
  services,
  staff,
  preselectedServiceId,
  preselectedStaffId,
}: Props) {
  const queryClient = useQueryClient();
  const initialService =
    services.find((s) => s.id === preselectedServiceId) ?? null;
  // Honour the deep-linked staff only if (a) a service was pre-selected,
  // (b) the staff still exists, and (c) they perform that service. Anything
  // less and we fall through to the staff picker so the user can choose.
  const initialStaffId =
    initialService &&
    preselectedStaffId &&
    staff.some(
      (s) =>
        s.id === preselectedStaffId &&
        s.serviceIds.includes(initialService.id),
    )
      ? preselectedStaffId
      : ANY_STAFF_ID;

  const [stage, setStage] = useState<Stage>(
    initialService
      ? initialStaffId !== ANY_STAFF_ID
        ? "pick-time"
        : "pick-staff"
      : "pick-service",
  );
  const [service, setService] = useState<PublicService | null>(initialService);
  const [staffId, setStaffId] = useState<string>(initialStaffId);
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
    endAt: string;
    serviceName: string;
    durationMinutes: number;
    staffName: string;
    displayTime: string;
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
  // Availability query
  // -------------------------------------------------------------------------
  const availability = useQuery({
    queryKey: ["availability", tenantSlug, service?.id, staffId, date],
    enabled: service !== null && stage === "pick-time",
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
      if (!service || !selectedSlot) return;
      const staffName =
        staffId === ANY_STAFF_ID
          ? "First available"
          : staff.find((s) => s.id === staffId)?.displayName ?? "Staff member";
      setConfirmation({
        id: res.bookingId,
        startAt: res.startAt,
        endAt: res.endAt,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        staffName,
        displayTime: selectedSlot.displayTime,
      });
      setStage("confirmed");
    },
    onError: (err) => {
      if (
        err instanceof ApiError &&
        (err.code === "SLOT_TAKEN" || err.code === "SLOT_UNAVAILABLE")
      ) {
        setSubmitError(
          "That time was just taken by another booking. Please pick another slot.",
        );
        setStage("pick-time");
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
        setStage("details");
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
  // Stage navigation helpers
  // -------------------------------------------------------------------------
  function goBack() {
    if (stage === "pick-staff") setStage("pick-service");
    else if (stage === "pick-time") setStage("pick-staff");
    else if (stage === "details") setStage("pick-time");
    else if (stage === "verify-otp") setStage("details");
  }

  const progressIdx = STAGES_FOR_PROGRESS.indexOf(stage);

  // -------------------------------------------------------------------------
  // CONFIRMED — full-screen success
  // -------------------------------------------------------------------------
  if (stage === "confirmed" && confirmation) {
    return (
      <ConfirmedScreen
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        tenantTimezone={tenantTimezone}
        confirmation={confirmation}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Main flow render
  // -------------------------------------------------------------------------
  const showBack = stage !== "pick-service" && stage !== "submitting";

  return (
    <div className="space-y-5">
      {/* Header: back chevron (top-left, native iOS pattern) + progress */}
      <div className="relative">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={goBack}
            className="absolute left-0 -top-1 z-10 h-9 w-9 -ml-2 sm:ml-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        {progressIdx >= 0 && (
          <div className={cn(showBack && "pl-10 sm:pl-12")}>
            <StageProgress
              steps={STAGES_FOR_PROGRESS.map((s) => STAGE_LABELS[s])}
              current={progressIdx}
            />
          </div>
        )}
      </div>

      {submitError && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-[hsl(30_60%_28%)]">
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
            setStage("pick-time");
          }}
        />
      )}

      {stage === "pick-time" && service && (
        <TimePicker
          tenantTimezone={tenantTimezone}
          date={date}
          onChangeDate={(d) => {
            setDate(d);
            setSelectedSlot(null);
          }}
          loading={availability.isFetching}
          error={availability.error}
          slots={availability.data?.slots ?? []}
          selected={selectedSlot?.startUtc ?? null}
          onPick={(slot) => {
            setSelectedSlot(slot);
            setStage("details");
          }}
        />
      )}

      {stage === "details" && service && selectedSlot && (
        <>
          <BookingSummaryCard
            serviceName={service.name}
            durationMinutes={service.durationMinutes}
            staffName={
              staffId === ANY_STAFF_ID
                ? "First available"
                : staff.find((s) => s.id === staffId)?.displayName ?? "Staff"
            }
            startUtc={selectedSlot.startUtc}
            displayTime={selectedSlot.displayTime}
            timezone={tenantTimezone}
            className="sticky top-16 z-10 bg-accent/95 backdrop-blur-sm shadow-sm"
          />
          <GuestDetailsForm
            initial={guestDetails}
            onContinue={(g) => {
              setGuestDetails(g);
              setSubmitError(null);
              if (grantToken) {
                submitBooking(grantToken);
                return;
              }
              setStage("verify-otp");
              otpRequest.mutate();
            }}
          />
        </>
      )}

      {stage === "verify-otp" && guestDetails && service && selectedSlot && (
        <>
          <BookingSummaryCard
            serviceName={service.name}
            durationMinutes={service.durationMinutes}
            staffName={
              staffId === ANY_STAFF_ID
                ? "First available"
                : staff.find((s) => s.id === staffId)?.displayName ?? "Staff"
            }
            startUtc={selectedSlot.startUtc}
            displayTime={selectedSlot.displayTime}
            timezone={tenantTimezone}
            className="sticky top-16 z-10 bg-accent/95 backdrop-blur-sm shadow-sm"
          />
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
          />
        </>
      )}

      {stage === "submitting" && (
        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 grid place-items-center text-primary animate-pulse">
            <Clock className="h-6 w-6" />
          </div>
          <p className="text-h3 text-foreground">Confirming your booking…</p>
          <p className="text-sm text-muted-foreground">Just a moment.</p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// PIECES
// ===========================================================================

function ServicePicker({
  services,
  onPick,
}: {
  services: PublicService[];
  onPick: (s: PublicService) => void;
}) {
  if (services.length === 0) {
    return (
      <EmptyState
        title="No services available yet"
        description="This business hasn't published any bookable services. Check back later."
      />
    );
  }
  return (
    <section className="space-y-3">
      <SectionTitle>Choose a service</SectionTitle>
      <ul className="space-y-2">
        {services.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 sm:p-5 transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  {s.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                      {s.description}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0">
                  {s.durationMinutes} min
                </Badge>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StaffPicker({
  service,
  staff,
  selected,
  onPick,
}: {
  service: PublicService;
  staff: PublicStaffMember[];
  selected: string;
  onPick: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <SectionTitle>Choose a staff member</SectionTitle>
        <p className="text-sm text-muted-foreground">
          For <span className="font-medium text-foreground">{service.name}</span>
        </p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        <li>
          <StaffCard
            label="Any available"
            sub="We'll pick whoever is free at your chosen time"
            active={selected === ANY_STAFF_ID}
            icon={<Sparkles className="h-5 w-5" />}
            onClick={() => onPick(ANY_STAFF_ID)}
          />
        </li>
        {staff.map((s) => {
          const initials =
            s.displayName
              .split(" ")
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase() || "?";
          return (
            <li key={s.id}>
              <StaffCard
                label={s.displayName}
                sub="Specialist"
                active={selected === s.id}
                icon={
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                }
                onClick={() => onPick(s.id)}
              />
            </li>
          );
        })}
      </ul>
      {staff.length === 0 && (
        <EmptyState
          icon={Users}
          title="No one's set up for this service yet"
          description="Try picking a different service, or check back later."
        />
      )}
    </section>
  );
}

function StaffCard({
  label,
  sub,
  active,
  icon,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full text-left rounded-2xl border bg-card p-4 transition flex items-center gap-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-accent/40 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground truncate">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

function TimePicker({
  tenantTimezone,
  date,
  onChangeDate,
  loading,
  error,
  slots,
  selected,
  onPick,
}: {
  tenantTimezone: string;
  date: string;
  onChangeDate: (d: string) => void;
  loading: boolean;
  error: unknown;
  slots: PublicAvailabilitySlot[];
  selected: string | null;
  onPick: (slot: PublicAvailabilitySlot) => void;
}) {
  const today = todayInZone(tenantTimezone);
  const maxDate = dateInZonePlusDays(tenantTimezone, 60);

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <SectionTitle>Pick a date and time</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Times shown in {tenantTimezone}.
        </p>
      </div>

      <DateStrip
        value={date}
        onChange={onChangeDate}
        min={today}
        max={maxDate}
        timezone={tenantTimezone}
      />

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((__, j) => (
                  <Skeleton key={j} className="h-12 sm:h-11 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error instanceof ApiError && (
        <p className="text-sm text-destructive">
          Could not load times: {error.message}
        </p>
      )}

      {!loading && !error && slots.length === 0 && (
        <EmptyState
          title="Nothing free on this date"
          description="Try another day from the strip above."
        />
      )}

      {slots.length > 0 && (
        <SlotList
          slots={slots}
          selected={selected}
          onSelect={onPick}
          timezone={tenantTimezone}
        />
      )}
    </section>
  );
}

function GuestDetailsForm({
  initial,
  onContinue,
}: {
  initial: GuestCustomerInput | null;
  onContinue: (g: GuestCustomerInput) => void;
}) {
  const form = useForm<GuestCustomerInput>({
    resolver: zodResolver(guestCustomerSchema),
    defaultValues: initial ?? {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      note: "",
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          if (!data.email) return; // OTP step requires email
          onContinue(data);
        })}
        className="space-y-4"
        noValidate
      >
        <SectionTitle>Your details</SectionTitle>

        <div className="grid sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  placeholder="+38970555100"
                  autoComplete="tel"
                  inputMode="tel"
                  {...field}
                />
              </FormControl>
              <FormDescription>Include the country code.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormDescription>
                We&apos;ll send a 6-digit code to confirm your booking.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Note <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <textarea
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-base text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 md:text-sm"
                  placeholder="Anything we should know?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-1">
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            Continue
          </Button>
        </div>
      </form>
    </Form>
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
}: {
  email: string;
  isRequesting: boolean;
  isConfirming: boolean;
  requestError: unknown;
  confirmError: unknown;
  onResend: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(30);

  // Resend cooldown — 30s after each request (initial + each resend).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);
  useEffect(() => {
    if (isRequesting) setCooldown(30);
  }, [isRequesting]);

  const confirmErrorMessage =
    confirmError instanceof ApiError ? confirmError.message : null;
  const requestErrorMessage =
    requestError instanceof ApiError ? requestError.message : null;

  return (
    <section className="space-y-5">
      <div className="space-y-1.5">
        <SectionTitle>Verify your email</SectionTitle>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      <div className="space-y-3">
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(c) => onSubmit(c)}
          invalid={!!confirmErrorMessage}
          disabled={isConfirming}
        />
        {confirmErrorMessage && (
          <p className="text-center text-xs text-destructive">
            {confirmErrorMessage}
          </p>
        )}
      </div>

      {requestErrorMessage && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-center space-y-2">
          <p className="text-xs text-[hsl(30_60%_28%)]">
            Couldn&apos;t send code: {requestErrorMessage}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!isRequesting) onResend();
            }}
            disabled={isRequesting}
          >
            {isRequesting ? "Trying again…" : "Try sending again"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            if (cooldown === 0 && !isRequesting) onResend();
          }}
          disabled={isRequesting || cooldown > 0}
          className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRequesting
            ? "Sending…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend code"}
        </button>
        <Button
          type="button"
          onClick={() => onSubmit(code)}
          disabled={code.length !== 6 || isConfirming}
          loading={isConfirming}
        >
          Verify & book
        </Button>
      </div>
    </section>
  );
}

function ConfirmedScreen({
  tenantSlug,
  tenantName,
  tenantTimezone,
  confirmation,
}: {
  tenantSlug: string;
  tenantName: string;
  tenantTimezone: string;
  confirmation: {
    id: string;
    startAt: string;
    endAt: string;
    serviceName: string;
    durationMinutes: number;
    staffName: string;
    displayTime: string;
  };
}) {
  const start = DateTime.fromISO(confirmation.startAt, { zone: "utc" })
    .setZone(tenantTimezone)
    .setLocale("en-US");
  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4 overflow-hidden">
        <Confetti />
        <div className="mx-auto h-16 w-16 rounded-full bg-success/10 grid place-items-center text-success scale-in">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.4} />
        </div>
        <div className="space-y-1">
          <h2 className="text-display sm:text-h1 text-foreground">
            You&apos;re booked!
          </h2>
          <p className="text-sm text-muted-foreground">
            A confirmation has been logged. Check your email if notifications
            are on.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-accent/30 p-4 text-left space-y-2 mx-auto max-w-sm">
          <p className="text-h3 text-foreground">{confirmation.serviceName}</p>
          <p className="text-sm text-foreground">
            {start.toFormat("ccc, LLL d, yyyy")} ·{" "}
            <span className="tabular-nums">{confirmation.displayTime}</span>{" "}
            <span className="text-xs text-muted-foreground">({tenantTimezone})</span>
          </p>
          <p className="text-sm text-muted-foreground">
            with {confirmation.staffName} · {confirmation.durationMinutes} min
          </p>
        </div>

        <p className="text-xs font-mono text-muted-foreground">
          Booking ref: {confirmation.id}
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-foreground">
          Add this to your calendar
        </p>
        <AddToCalendarButtons
          title={`${confirmation.serviceName} · ${tenantName}`}
          startUtc={confirmation.startAt}
          endUtc={confirmation.endAt}
          description={`With ${confirmation.staffName} at ${tenantName}.`}
          location={tenantName}
          uid={confirmation.id}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
        <Button asChild variant="secondary">
          <Link href={`/${tenantSlug}`}>Back to {tenantName}</Link>
        </Button>
        <Button asChild>
          <Link href={`/${tenantSlug}/book`}>Book another</Link>
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-h2 text-foreground">{children}</h2>;
}

/**
 * Tiny confetti-burst for the confirmation screen. Pure CSS — no canvas, no
 * deps. The whole shower respects `prefers-reduced-motion: reduce`: the
 * animation keyframes are gated behind `no-preference` in globals.css via
 * the `.confetti-piece` class, so motion-averse users see nothing.
 */
function Confetti() {
  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(var(--accent-foreground))",
  ];
  const pieces = Array.from({ length: 18 });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center"
    >
      {pieces.map((_, i) => {
        const left = ((i * 37) % 95) + 2; // pseudo-random across the row
        const delay = (i % 6) * 80;
        const duration = 900 + ((i * 53) % 400);
        const color = colors[i % colors.length];
        const size = (i % 3) + 6;
        return (
          <span
            key={i}
            className="confetti-piece absolute block"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size + 2}px`,
              background: color,
              borderRadius: i % 2 === 0 ? "9999px" : "2px",
              animationDelay: `${delay}ms`,
              animationDuration: `${duration}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
