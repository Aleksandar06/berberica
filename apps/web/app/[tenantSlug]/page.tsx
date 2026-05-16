import Link from "next/link";

import { publicApi } from "@/lib/api/public";

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default async function StorefrontLandingPage({ params }: Props) {
  const { tenantSlug } = await params;
  const profile = await publicApi.getProfile(tenantSlug);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {profile.businessType.replace(/_/g, " ")}
        </p>
        <h1
          className="text-4xl font-bold text-slate-900"
          style={{ color: "var(--brand-primary)" }}
        >
          {profile.name}
        </h1>
        {profile.address && (
          <p className="text-slate-600">{profile.address}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-4">
          <Link href={`/${tenantSlug}/book`} className="btn-primary">
            Book now
          </Link>
          <Link href={`/${tenantSlug}/services`} className="btn-secondary">
            See services
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4 text-sm">
        {profile.contactPhone && (
          <InfoTile label="Phone" value={profile.contactPhone} />
        )}
        {profile.contactEmail && (
          <InfoTile label="Email" value={profile.contactEmail} />
        )}
        <InfoTile label="Timezone" value={profile.timezone} />
      </section>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-slate-900 mt-1">{value}</p>
    </div>
  );
}
