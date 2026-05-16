"use client";

import { Building2, LayoutDashboard, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import {
  DashboardShell,
  type NavItem,
} from "@/components/dashboard/dashboard-shell";

/**
 * Admin nav is small enough that all items can live on the bottom tab bar
 * on mobile — but "Create tenant" is a tertiary action, so we keep it
 * desktop-sidebar-only and surface a "New" button from the Tenants list page.
 */
const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard, mobileTab: true },
  { href: "/dashboard/admin/tenants", label: "Tenants", icon: Building2, mobileTab: true },
  { href: "/dashboard/admin/tenants/new", label: "Create tenant", icon: Plus },
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
