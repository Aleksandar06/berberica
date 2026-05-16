"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Client-side provider tree. Wraps the app with TanStack Query, the
 * Radix Tooltip provider (so any Tooltip in the tree works without
 * additional plumbing), and the Sonner toaster.
 *
 * QueryClient is created inside `useState` so HMR / re-renders don't
 * recreate the cache (which would otherwise lose every in-flight
 * request mid-update).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <ConfirmDialogProvider>
          {children}
          <Toaster />
        </ConfirmDialogProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
