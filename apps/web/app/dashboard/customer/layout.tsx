"use client";

import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const CUSTOMER_NAV = [
  { href: "/dashboard/customer", label: "My bookings" },
];

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    // CUSTOMER role is implicit (any authenticated user can land here),
    // so we just require *any* authenticated session.
    <RoleGuard
      roles={["CUSTOMER", "TENANT_ADMIN", "STAFF", "SUPER_ADMIN"]}
    >
      <DashboardShell title="My account" nav={CUSTOMER_NAV}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
