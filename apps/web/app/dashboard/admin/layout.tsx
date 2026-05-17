"use client";

import { Building2, LayoutDashboard, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { RoleGuard } from "@/components/dashboard/role-guard";
import {
  DashboardShell,
  type NavItem,
} from "@/components/dashboard/dashboard-shell";
import { useT } from "@/lib/i18n/language-context";

/**
 * Admin nav is small enough that all items can live on the bottom tab bar
 * on mobile — but "Create tenant" is a tertiary action, so we keep it
 * desktop-sidebar-only and surface a "New" button from the Tenants list page.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useT();
  const nav: NavItem[] = [
    { href: "/dashboard/admin", label: t.nav.platformOverview, icon: LayoutDashboard, mobileTab: true },
    { href: "/dashboard/admin/tenants", label: t.nav.tenants, icon: Building2, mobileTab: true },
    { href: "/dashboard/admin/tenants/new", label: t.nav.tenants + " +", icon: Plus },
  ];
  return (
    <RoleGuard roles={["SUPER_ADMIN"]}>
      <DashboardShell title={t.nav.platformOverview} nav={nav}>
        {children}
      </DashboardShell>
    </RoleGuard>
  );
}
