"use client";

import { CalendarRange, Coffee, Plus } from "lucide-react";
import Link from "next/link";

/**
 * Three pill-style quick actions sitting under the next-up card. These
 * are the actions a barber reaches for between clients:
 *  • Add walk-in → drops them into the bookings page where they can
 *    create on-the-fly (proper "Add walk-in flag" lives behind backend
 *    flag B2; the current link uses the existing bookings list as a
 *    safe starting point).
 *  • View week → jumps straight to the calendar view in bookings.
 *  • Block time → straight to the availability page's exceptions area.
 *
 * Kept as Links (not buttons) so they get cmd-click and middle-click
 * "open in new tab" behaviour for free — a small detail a power user
 * notices.
 */
export function TodayQuickActions() {
  const items: Array<{
    label: string;
    icon: React.ReactNode;
    href: string;
    helper: string;
  }> = [
    {
      label: "Add walk-in",
      icon: <Plus className="h-4 w-4" />,
      href: "/dashboard/business/bookings",
      helper: "Slot in a cash customer",
    },
    {
      label: "View week",
      icon: <CalendarRange className="h-4 w-4" />,
      href: "/dashboard/business/bookings",
      helper: "Week calendar",
    },
    {
      label: "Block time",
      icon: <Coffee className="h-4 w-4" />,
      href: "/dashboard/business/availability",
      helper: "Lunch, break, day off",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group rounded-2xl border border-border bg-card p-3 flex items-center gap-3 transition hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span
            aria-hidden
            className="grid place-items-center h-9 w-9 rounded-full bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform"
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {item.label}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {item.helper}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
