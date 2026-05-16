"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { loginInputSchema, type LoginInput } from "@scheduling/schemas";

/**
 * Login page. Single screen for all three roles — the post-login router
 * decides which dashboard to land on based on memberships.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      // login() handles the post-success redirect via the role router.
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Please try again.",
      );
    }
  }

  // Dev-only seed credentials block. Gated on NODE_ENV so it never ships
  // to production — keep this even if the build flow is supposed to omit
  // it; defense in depth.
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8 space-y-5"
          noValidate
        >
            <div className="space-y-1.5">
              <h1 className="text-h1 text-foreground">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Sign in to manage your bookings.
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                {formError}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={form.formState.isSubmitting}
            >
              Sign in
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              New customer?{" "}
              <Link
                href="/dashboard/register"
                className="text-primary font-medium hover:underline"
              >
                Create an account
              </Link>
            </p>
        </form>
      </Form>

      {isDev && (
        <details
          className="mt-4 rounded-xl border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground"
          // Closed by default — keeps the production-ish polish even in
          // dev while still being a single-click reveal for seeding.
        >
          <summary className="cursor-pointer font-medium text-foreground">
            Dev seed credentials
          </summary>
          <div className="mt-2 space-y-1.5 font-mono">
            <p>admin@elite-barbers.test</p>
            <p>admin@smile-dental.test</p>
            <p>superadmin@example.com</p>
            <p className="pt-1 border-t border-border/50">
              password: <span className="text-foreground">dev-password-123</span>
            </p>
          </div>
        </details>
      )}
    </AuthLayout>
  );
}
