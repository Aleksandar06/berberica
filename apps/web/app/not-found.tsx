import Link from "next/link";

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md text-center space-y-3">
        <p className="text-xs uppercase tracking-wider text-slate-400">404</p>
        <h1 className="text-3xl font-semibold text-slate-900">
          Page not found
        </h1>
        <p className="text-slate-600">
          We couldn&apos;t find what you were looking for.
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
