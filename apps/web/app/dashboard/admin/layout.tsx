"use client";

import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin/tenants", label: "Tenants" },
  { href: "/dashboard/admin/tenants/new", label: "Create tenant" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={["SUPER_ADMIN"]}>
      <DashboardShell title="Super admin" nav={ADMIN_NAV}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
