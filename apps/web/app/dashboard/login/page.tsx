"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Login page. Single screen for all three roles — the post-login router
 * decides which dashboard to land on based on memberships.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      // login() handles the post-success redirect via the role router.
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white rounded-lg border shadow-sm p-8 space-y-5"
        noValidate
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-600">
            Use your account to access your dashboard.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-sm text-slate-600 text-center">
          New customer?{" "}
          <Link
            href="/dashboard/register"
            className="text-blue-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-xs text-slate-400 text-center">
          Seed credentials for dev: <code>admin@elite-barbers.test</code>{" "}
          <code>admin@smile-dental.test</code>{" "}
          <code>superadmin@example.com</code> (all password{" "}
          <code>dev-password-123</code>)
        </p>
      </form>
    </main>
  );
}
