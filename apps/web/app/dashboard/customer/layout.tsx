"use client";

import { Calendar } from "lucide-react";
import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import {
  DashboardShell,
  type NavItem,
} from "@/components/dashboard/dashboard-shell";
import { useT } from "@/lib/i18n/language-context";

/**
 * Customer dashboard has a single page so far — bookings. Marking it as a
 * mobile tab still gives the user the muscle-memory anchor (and we'll add
 * "Profile" / "Saved venues" in a later phase).
 */
export default function CustomerLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const nav: NavItem[] = [
    { href: "/dashboard/customer", label: t.nav.myBookings, icon: Calendar, mobileTab: true },
  ];
  return (
    // CUSTOMER role is implicit — any authenticated user can land here, so
    // we accept every role rather than gating on CUSTOMER specifically.
    <RoleGuard roles={["CUSTOMER", "TENANT_ADMIN", "STAFF", "SUPER_ADMIN"]}>
      <DashboardShell title={t.nav.myBookings} nav={nav}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
