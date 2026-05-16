"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { dashboardForMemberships, hasRole } from "@/lib/auth/role-router";
import type { Membership } from "@/lib/api/auth";

interface RoleGuardProps {
  roles: Array<Membership["role"]>;
  children: ReactNode;
}

/**
 * Client-side gate for an authenticated section. While bootstrapping the
 * session, renders a thin loading state. When the session is missing or
 * the role doesn't match, redirects to login (or the user's correct
 * dashboard) and renders nothing.
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { bootstrapping, user, memberships } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapping) return;
    if (!user) {
      router.replace("/dashboard/login");
      return;
    }
    if (!hasRole(memberships, roles)) {
      router.replace(dashboardForMemberships(memberships));
    }
  }, [bootstrapping, user, memberships, roles, router]);

  if (bootstrapping || !user || !hasRole(memberships, roles)) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }
  return <>{children}</>;
}
