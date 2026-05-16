"use client";

import { DateTime } from "luxon";
import { useMemo } from "react";

import type { PublicAvailabilitySlot } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export interface SlotListProps {
  slots: PublicAvailabilitySlot[];
  selected: string | null;
  onSelect: (slot: PublicAvailabilitySlot) => void;
  /** Tenant timezone, used to bucket slots into morning/afternoon/evening. */
  timezone: string;
}

/**
 * Vertical list of slots on mobile (one slot per row, full-width — easier
 * to tap than a 3-column grid at 375px), grid on tablet+. Slots are
 * bucketed by period of day so a customer can quickly scan to "afternoon"
 * without scrolling through a long flat list.
 */
export function SlotList({
  slots,
  selected,
  onSelect,
  timezone,
}: SlotListProps) {
  const groups = useMemo(() => {
    const morning: PublicAvailabilitySlot[] = [];
    const afternoon: PublicAvailabilitySlot[] = [];
    const evening: PublicAvailabilitySlot[] = [];
    for (const s of slots) {
      const h = DateTime.fromISO(s.startUtc, { zone: "utc" })
        .setZone(timezone)
        .hour;
      if (h < 12) morning.push(s);
      else if (h < 17) afternoon.push(s);
      else evening.push(s);
    }
    return { morning, afternoon, evening };
  }, [slots, timezone]);

  return (
    <div className="space-y-5">
      {groups.morning.length > 0 && (
        <SlotGroup label="Morning" slots={groups.morning} selected={selected} onSelect={onSelect} />
      )}
      {groups.afternoon.length > 0 && (
        <SlotGroup label="Afternoon" slots={groups.afternoon} selected={selected} onSelect={onSelect} />
      )}
      {groups.evening.length > 0 && (
        <SlotGroup label="Evening" slots={groups.evening} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

function SlotGroup({
  label,
  slots,
  selected,
  onSelect,
}: {
  label: string;
  slots: PublicAvailabilitySlot[];
  selected: string | null;
  onSelect: (slot: PublicAvailabilitySlot) => void;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {slots.map((s) => {
          const isSel = selected === s.startUtc;
          return (
            <button
              key={s.startUtc}
              type="button"
              onClick={() => onSelect(s)}
              aria-pressed={isSel}
              className={cn(
                "h-12 rounded-xl border text-base font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "sm:h-11 sm:text-sm",
                isSel
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent",
              )}
            >
              {s.displayTime}
            </button>
          );
        })}
      </div>
    </section>
  );
}
