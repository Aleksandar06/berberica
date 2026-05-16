"use client";

import { type ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

/**
 * Toast helpers.
 *
 * History: pre-Phase-1 this was a hand-rolled context provider with a
 * fixed bottom-right stack. Phase 1 swaps the runtime over to Sonner
 * (mounted in `<Providers>`), but keeps the `useToast()` API surface
 * identical so every existing call site (`toast.success(...)`,
 * `toast.error(...)`) keeps working without an edit.
 */

interface ToastApi {
  success(message: string, opts?: { description?: ReactNode }): void;
  error(message: string, opts?: { description?: ReactNode }): void;
  info(message: string, opts?: { description?: ReactNode }): void;
  warning(message: string, opts?: { description?: ReactNode }): void;
  dismiss(): void;
}

const api: ToastApi = {
  success: (m, opts) => sonnerToast.success(m, opts),
  error: (m, opts) => sonnerToast.error(m, opts),
  info: (m, opts) => sonnerToast.message(m, opts),
  warning: (m, opts) => sonnerToast.warning(m, opts),
  dismiss: () => sonnerToast.dismiss(),
};

/**
 * Hook kept for source-compat. Sonner is module-scoped under the hood,
 * so unlike the old `ToastProvider`-bound implementation, this hook no
 * longer throws when called outside a provider — it just routes through
 * the Sonner toaster mounted in `<Providers>`.
 */
export function useToast(): ToastApi {
  return api;
}

/**
 * Backwards-compat no-op. The old `<ToastProvider>` mounted the stack
 * itself; Sonner mounts via `<Toaster>` in `<Providers>` now. Keeping
 * this export as a passthrough avoids breaking any code that still
 * wraps a subtree in it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Convenience: turn unknown errors into a string for toasting. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong";
}

/** Direct named export for code that prefers a non-hook import. */
export const toast = api;
