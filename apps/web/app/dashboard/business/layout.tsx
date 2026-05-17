"use client";

import {
  CalendarDays,
  Clock,
  Gauge,
  LayoutDashboard,
  PiggyBank,
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
import { useT } from "@/lib/i18n/language-context";

/**
 * Tab-bar choice: `Today` + `Bookings` + `Staff` are the three highest-frequency
 * destinations for an active venue's owner — they're what's tapped multiple
 * times per shift. Everything else lives in the "More" drawer to keep the
 * thumb-reach surface uncluttered.
 */
export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const nav: NavItem[] = [
    { href: "/dashboard/business", label: t.nav.today, icon: LayoutDashboard, mobileTab: true },
    { href: "/dashboard/business/bookings", label: t.nav.bookings, icon: CalendarDays, mobileTab: true },
    { href: "/dashboard/business/staff", label: t.nav.staff, icon: Users, mobileTab: true },
    { href: "/dashboard/business/services", label: t.nav.services, icon: Scissors },
    { href: "/dashboard/business/earnings", label: t.nav.earnings, icon: PiggyBank },
    { href: "/dashboard/business/availability", label: t.nav.availability, icon: Clock },
    { href: "/dashboard/business/capacity-preview", label: t.nav.capacityPreview, icon: Gauge },
    { href: "/dashboard/business/settings", label: t.nav.settings, icon: Settings },
  ];
  return (
    <RoleGuard roles={["TENANT_ADMIN", "STAFF", "SUPER_ADMIN"]}>
      <DashboardShell title="Business" nav={nav}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
