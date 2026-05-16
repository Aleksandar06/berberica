import Link from "next/link";

/**
 * Platform landing page. Customer-visible storefronts live under
 * `/{tenantSlug}` — this page just exists so the root URL isn't a 404.
 * Real marketing copy is out of scope for the MVP.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-xl space-y-4">
        <h1 className="text-4xl font-semibold text-slate-900">
          Scheduling SaaS
        </h1>
        <p className="text-slate-600">
          Multi-tenant appointment booking platform. Each business lives at
          its own slug, e.g.{" "}
          <Link
            href="/elite-barbers"
            className="text-blue-600 hover:underline"
          >
            /elite-barbers
          </Link>{" "}
          or{" "}
          <Link href="/smile-dental" className="text-blue-600 hover:underline">
            /smile-dental
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
