"use client";

import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const BUSINESS_NAV = [
  { href: "/dashboard/business", label: "Overview" },
  { href: "/dashboard/business/bookings", label: "Bookings" },
  { href: "/dashboard/business/services", label: "Services" },
  { href: "/dashboard/business/staff", label: "Staff" },
  { href: "/dashboard/business/availability", label: "Availability" },
  { href: "/dashboard/business/capacity-preview", label: "Capacity preview" },
  { href: "/dashboard/business/settings", label: "Settings" },
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
