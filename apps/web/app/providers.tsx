"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Client-side provider tree. Wraps the app with a TanStack Query client.
 * The client is created inside `useState` so HMR / re-renders don't recreate
 * the cache (which would otherwise lose every in-flight request mid-update).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Public storefront calls are cheap reads; a 30s window keeps
            // the UX snappy without hammering the API on every focus event.
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
