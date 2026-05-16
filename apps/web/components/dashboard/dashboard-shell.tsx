"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth/auth-context";

export interface NavItem {
  href: string;
  label: string;
}

interface ShellProps {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}

/**
 * Persistent sidebar + topbar shell shared by all three role dashboards.
 * Active link is highlighted by exact pathname match (good enough for our
 * flat structure; no nested-segment trickery needed).
 */
export function DashboardShell({ title, nav, children }: ShellProps) {
  const { user, memberships, logout } = useAuth();
  const pathname = usePathname();

  const activeBusiness = memberships.find(
    (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-semibold text-slate-900">
              Scheduling SaaS
            </Link>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-600">{title}</span>
            {activeBusiness && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-xs rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                  {activeBusiness.tenantName}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 hidden sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="text-slate-600 hover:text-slate-900 hover:underline"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Dashboard navigation" className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
