"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { dashboardForMemberships } from "@/lib/auth/role-router";
import { Spinner } from "@/components/ui/spinner";

/**
 * Bare /dashboard entrypoint. Once the session is bootstrapped, routes the
 * user to the correct role-specific dashboard (or to /login if anonymous).
 */
export default function DashboardEntry() {
  const { bootstrapping, user, memberships } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (bootstrapping) return;
    if (!user) {
      router.replace("/dashboard/login");
      return;
    }
    router.replace(dashboardForMemberships(memberships));
  }, [bootstrapping, user, memberships, router]);

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <Spinner label="Loading your dashboard…" size="md" />
    </div>
  );
}
