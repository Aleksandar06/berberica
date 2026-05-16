import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/lib/ui/toast";

/**
 * Root dashboard layout. Wraps every authenticated area (admin + business +
 * customer + login/register) with the AuthProvider so the session bootstrap
 * runs once. Toasts are also global so any page can emit one.
 *
 * The /dashboard URL itself routes by role in `app/dashboard/page.tsx`.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
