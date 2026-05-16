import Link from "next/link";

import { publicApi } from "@/lib/api/public";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default async function ServicesPage({ params }: Props) {
  const { tenantSlug } = await params;
  const services = await publicApi.getServices(tenantSlug);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Services</h1>
          <p className="text-slate-600 text-sm mt-1">
            Choose any service to start your booking.
          </p>
        </div>
        <Link href={`/${tenantSlug}/book`} className="btn-primary hidden sm:inline-flex">
          Book a service
        </Link>
      </header>

      {services.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          This business hasn&apos;t published any services yet.
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {services.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {s.name}
                </h2>
                <span className="text-xs rounded bg-slate-100 text-slate-700 px-2 py-1 whitespace-nowrap">
                  {s.durationMinutes} min
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-slate-600 mt-2">{s.description}</p>
              )}
              <Link
                href={`/${tenantSlug}/book?serviceId=${s.id}`}
                className="btn-primary mt-4 self-start"
              >
                Book {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
