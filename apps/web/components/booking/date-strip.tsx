"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DateStripProps {
  /** Selected date as YYYY-MM-DD in the tenant TZ. */
  value: string;
  onChange: (date: string) => void;
  /** Earliest selectable date (inclusive). YYYY-MM-DD in tenant TZ. */
  min: string;
  /** Latest selectable date (inclusive). YYYY-MM-DD in tenant TZ. */
  max: string;
  /** Tenant IANA timezone (used to derive "today" for the today-ring). */
  timezone: string;
}

/**
 * Horizontally-scrollable date picker — the dominant date-selection pattern
 * for booking flows on mobile (Cal.com, Calendly, Treatwell all use it).
 *
 * Each cell shows the day name above the day number. The selected cell is
 * filled primary, the today cell gets a subtle ring, disabled cells (outside
 * min/max) render muted.
 *
 * On change, the strip scrolls the picked date into view so it stays in the
 * thumb-reach band as the user explores the date space.
 */
export function DateStrip({
  value,
  onChange,
  min,
  max,
  timezone,
}: DateStripProps) {
  const today = DateTime.now().setZone(timezone).toISODate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const days = useMemo(() => {
    const start = DateTime.fromISO(min);
    const end = DateTime.fromISO(max);
    const out: { iso: string; dt: DateTime }[] = [];
    let cursor = start;
    // Bounded loop — 6 months max so a bad max doesn't hang the UI.
    let safety = 0;
    while (cursor <= end && safety < 200) {
      const iso = cursor.toISODate();
      if (iso) out.push({ iso, dt: cursor });
      cursor = cursor.plus({ days: 1 });
      safety++;
    }
    return out;
  }, [min, max]);

  // Scroll the selected date into view when it changes (and on first mount).
  useEffect(() => {
    const el = cellRefs.current.get(value);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [value]);

  function scrollBy(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 240, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Desktop scroll arrows — pointless on touch where the user just swipes */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous days"
        onClick={() => scrollBy(-1)}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 bg-background shadow-sm border border-border"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next days"
        onClick={() => scrollBy(1)}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 bg-background shadow-sm border border-border"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div
        ref={scrollRef}
        role="radiogroup"
        aria-label="Pick a date"
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 px-1 py-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map(({ iso, dt }) => {
          const selected = iso === value;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              ref={(el) => {
                if (el) cellRefs.current.set(iso, el);
                else cellRefs.current.delete(iso);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(iso)}
              className={cn(
                "snap-start shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl border transition relative",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium uppercase tracking-wide",
                  selected ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {dt.toFormat("ccc")}
              </span>
              <span className="text-xl font-semibold tabular-nums leading-tight">
                {dt.toFormat("d")}
              </span>
              {isToday && !selected && (
                <span
                  aria-hidden
                  className="absolute bottom-2 h-1 w-1 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
