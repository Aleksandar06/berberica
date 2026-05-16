"use client";

import {
  CalendarDays,
  Clock,
  Gauge,
  LayoutDashboard,
  Scissors,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import {
  DashboardShell,
  type NavItem,
} from "@/components/dashboard/dashboard-shell";

/**
 * Tab-bar choice: `Today` + `Bookings` + `Staff` are the three highest-frequency
 * destinations for an active venue's owner — they're what's tapped multiple
 * times per shift. Everything else lives in the "More" drawer to keep the
 * thumb-reach surface uncluttered.
 */
const BUSINESS_NAV: NavItem[] = [
  { href: "/dashboard/business", label: "Today", icon: LayoutDashboard, mobileTab: true },
  { href: "/dashboard/business/bookings", label: "Bookings", icon: CalendarDays, mobileTab: true },
  { href: "/dashboard/business/staff", label: "Staff", icon: Users, mobileTab: true },
  { href: "/dashboard/business/services", label: "Services", icon: Scissors },
  { href: "/dashboard/business/availability", label: "Availability", icon: Clock },
  { href: "/dashboard/business/capacity-preview", label: "Capacity preview", icon: Gauge },
  { href: "/dashboard/business/settings", label: "Settings", icon: Settings },
];

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={["TENANT_ADMIN", "STAFF", "SUPER_ADMIN"]}>
      <DashboardShell title="Business" nav={BUSINESS_NAV}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
