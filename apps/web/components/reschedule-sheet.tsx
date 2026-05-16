"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/public";
import type { PublicAvailabilitySlot } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  dateInZonePlusDays,
  todayInZone,
} from "@/lib/format/time";
import { cn } from "@/lib/utils";
import { errorMessage, useToast } from "@/lib/ui/toast";

export interface RescheduleSheetProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Header context the user is rescheduling. */
  context: {
    serviceName: string;
    staffName: string;
    tenantName: string;
  };
  /**
   * The booking being rescheduled. We hit the public availability endpoint
   * scoped to this tenant slug to render a live slot list, then post the
   * new start time to `onSubmit`. The backend revalidates and 409s if the
   * slot was taken between fetch and submit.
   */
  bookingId: string;
  tenantSlug: string;
  tenantTimezone: string;
  serviceId: string;
  staffMemberId: string;
  /** Mutation function passed in so customer + business can wire their own API path. */
  onSubmit: (newStartAt: string) => Promise<unknown>;
  onSuccess?: () => void;
}

/**
 * Shared reschedule dialog used by both the customer "My bookings" and the
 * business bookings dashboards. Extracted in Phase 2 so we no longer rely
 * on `window.prompt` for business rescheduling.
 *
 * The slot picker is intentionally minimal here (date input + responsive
 * slot grid) — Phase 4 will replace the picker with the same date-strip /
 * vertical-list component used in the public booking flow.
 */
export function RescheduleSheet({
  open,
  onOpenChange,
  context,
  bookingId: _bookingId,
  tenantSlug,
  tenantTimezone,
  serviceId,
  staffMemberId,
  onSubmit,
  onSuccess,
}: RescheduleSheetProps) {
  const toast = useToast();
  const [date, setDate] = useState<string>(() => todayInZone(tenantTimezone));
  const [picked, setPicked] = useState<PublicAvailabilitySlot | null>(null);

  const availability = useQuery({
    queryKey: ["reschedule-availability", tenantSlug, serviceId, staffMemberId, date],
    enabled: open,
    queryFn: () =>
      publicApi.getAvailability(tenantSlug, {
        serviceId,
        staffId: staffMemberId,
        date,
      }),
  });

  const submit = useMutation({
    mutationFn: (newStartAt: string) => onSubmit(newStartAt) as Promise<unknown>,
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      setPicked(null);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "SLOT_UNAVAILABLE") {
        toast.error("That slot is no longer available — pick another.");
        void availability.refetch();
        setPicked(null);
      } else if (e instanceof ApiError && e.code === "SLOT_TAKEN") {
        toast.error("That slot was just taken — pick another.");
        void availability.refetch();
        setPicked(null);
      } else if (e instanceof ApiError && e.code === "RESCHEDULE_NOT_ALLOWED") {
        toast.error("This booking can no longer be rescheduled online.");
        onOpenChange(false);
      } else {
        toast.error(errorMessage(e));
      }
    },
  });

  const today = todayInZone(tenantTimezone);
  const maxDate = dateInZonePlusDays(tenantTimezone, 60);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {context.serviceName} with {context.staffName} at {context.tenantName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="reschedule-date">Pick a new date</Label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reschedule-date"
                type="date"
                value={date}
                min={today}
                max={maxDate}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPicked(null);
                }}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Times shown in {tenantTimezone}.
            </p>
          </div>

          {availability.isLoading && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          )}

          {availability.isError && (
            <p className="text-sm text-destructive">
              Could not load times: {errorMessage(availability.error)}
            </p>
          )}

          {availability.data && availability.data.slots.length === 0 && (
            <EmptyState
              title="No openings on this date"
              description="Try another day from the picker above."
            />
          )}

          {availability.data && availability.data.slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {availability.data.slots.map((s) => {
                const isSel = picked?.startUtc === s.startUtc;
                return (
                  <button
                    key={s.startUtc}
                    type="button"
                    onClick={() => setPicked(s)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSel
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background hover:border-primary/40 hover:bg-accent",
                    )}
                  >
                    {s.displayTime}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked || submit.isPending}
            loading={submit.isPending}
            onClick={() => {
              if (picked) submit.mutate(picked.startUtc);
            }}
          >
            Confirm new time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
