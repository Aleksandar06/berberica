"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "../api/auth";
import type { MeResponse, Membership, SessionUser } from "../api/auth";
import { authStore } from "./auth-store";
import { dashboardForMemberships } from "./role-router";

interface AuthContextValue {
  user: SessionUser | null;
  memberships: Membership[];
  /** True until the bootstrap refresh attempt completes. */
  bootstrapping: boolean;
  /** Performs login, sets in-memory token, fetches /me, routes by role. */
  login(email: string, password: string): Promise<void>;
  /** Registers a new customer + auto-logs in. */
  register(input: authApi.RegisterInput): Promise<void>;
  logout(): Promise<void>;
  /** Force a fresh /me fetch (e.g. after a settings change updates a flag). */
  refreshMe(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Top-level auth provider. Lives inside `app/dashboard/layout.tsx` so every
 * dashboard subtree shares one session state.
 *
 * Bootstrap flow on first mount:
 *   1. POST /api/auth/refresh (uses HttpOnly refresh cookie).
 *   2. On 200 → store access token, then fetch /me → populate user + memberships.
 *   3. On 401 → leave logged out; pages can gate via `useRequireAuth`.
 *
 * The `unauthorized` callback handles the live-session 401 path: an authed
 * call inside the dashboard 401s mid-session → the authed client calls
 * /refresh once → if that also 401s, it calls `authStore.notifyUnauthorized`
 * which we wire to "clear local state + push to /dashboard/login".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const bootstrappedRef = useRef(false);

  const handleUnauthorized = useCallback(() => {
    authStore.setAccessToken(null);
    authStore.setTenantSlug(null);
    setUser(null);
    setMemberships([]);
    router.push("/dashboard/login");
  }, [router]);

  useEffect(() => {
    authStore.setOnUnauthorized(handleUnauthorized);
    return () => authStore.setOnUnauthorized(null);
  }, [handleUnauthorized]);

  // Tenant slug for X-Tenant-Slug: pick the first qualifying business
  // membership. Single-membership users don't need it; multi-membership users
  // get a deterministic pick (could later be a per-session preference).
  const applyTenantSlugForMemberships = useCallback((ms: Membership[]) => {
    const business = ms.find(
      (m) => m.role === "TENANT_ADMIN" || m.role === "STAFF",
    );
    authStore.setTenantSlug(business?.tenantSlug ?? null);
  }, []);

  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const me = await authApi.me();
      setUser(me.user);
      setMemberships(me.memberships);
      applyTenantSlugForMemberships(me.memberships);
      return me;
    } catch {
      return null;
    }
  }, [applyTenantSlugForMemberships]);

  // Bootstrap once on mount.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: "{}",
          },
        );
        if (res.ok) {
          const data = (await res.json()) as { accessToken: string };
          authStore.setAccessToken(data.accessToken);
          await fetchMe();
        }
      } catch {
        /* anonymous on bootstrap is fine */
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [fetchMe]);

  const login = useCallback<AuthContextValue["login"]>(
    async (email, password) => {
      const res = await authApi.login(email, password);
      authStore.setAccessToken(res.accessToken);
      const me = await fetchMe();
      const target = me ? dashboardForMemberships(me.memberships) : "/dashboard";
      router.push(target);
    },
    [fetchMe, router],
  );

  const register = useCallback<AuthContextValue["register"]>(
    async (input) => {
      const res = await authApi.register(input);
      authStore.setAccessToken(res.accessToken);
      const me = await fetchMe();
      const target = me ? dashboardForMemberships(me.memberships) : "/dashboard";
      router.push(target);
    },
    [fetchMe, router],
  );

  const logout = useCallback<AuthContextValue["logout"]>(async () => {
    try {
      await authApi.logout();
    } catch {
      /* best-effort */
    }
    authStore.setAccessToken(null);
    authStore.setTenantSlug(null);
    setUser(null);
    setMemberships([]);
    router.push("/dashboard/login");
  }, [router]);

  const refreshMe = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      memberships,
      bootstrapping,
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, memberships, bootstrapping, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
