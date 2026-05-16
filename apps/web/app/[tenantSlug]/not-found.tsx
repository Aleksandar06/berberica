import Link from "next/link";

/**
 * Renders when the tenant layout's profile fetch returns 404 (unknown slug,
 * reserved slug, or malformed). Generic copy — never reveals whether the
 * slug exists for system reasons.
 */
export default function TenantNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md text-center space-y-3">
        <p className="text-xs uppercase tracking-wider text-slate-400">404</p>
        <h1 className="text-3xl font-semibold text-slate-900">
          We couldn&apos;t find that business
        </h1>
        <p className="text-slate-600">
          Double-check the address — businesses on this platform live at their
          own URL.
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-4 text-blue-600 hover:underline"
        >
          ← Back to the platform home
        </Link>
      </div>
    </main>
  );
}
