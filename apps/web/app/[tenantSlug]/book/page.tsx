import { publicApi } from "@/lib/api/public";
import { BookingFlow } from "./booking-flow";

/**
 * Server component: fetches tenant profile + services + staff in parallel
 * so the booking flow has everything it needs on first render. The actual
 * interaction is in the client component below.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ serviceId?: string; staffId?: string }>;
}) {
  const { tenantSlug } = await params;
  const { serviceId: preselectedServiceId, staffId: preselectedStaffId } =
    await searchParams;
  const [profile, services, staff] = await Promise.all([
    publicApi.getProfile(tenantSlug),
    publicApi.getServices(tenantSlug),
    publicApi.getStaff(tenantSlug),
  ]);
  return (
    <BookingFlow
      tenantSlug={tenantSlug}
      tenantName={profile.name}
      tenantTimezone={profile.timezone}
      services={services}
      staff={staff}
      preselectedServiceId={preselectedServiceId}
      preselectedStaffId={preselectedStaffId}
    />
  );
}
