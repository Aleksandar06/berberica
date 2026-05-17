/**
 * Response types for the public storefront API. These mirror the shapes
 * returned by the controllers in `apps/api/src/modules/public/...`.
 *
 * Keeping them as a separate file (rather than importing Prisma types)
 * means the web bundle never accidentally pulls in server-only dependencies.
 */
import type {
  BookingRequestInput,
  GuestOtpConfirmInput,
  GuestOtpRequestInput,
} from "@scheduling/schemas";

export interface PublicTenantProfile {
  name: string;
  slug: string;
  businessType: string;
  timezone: string;
  /** ISO 4217 currency code — drives price + earnings formatting on the storefront. */
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  } | null;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  /** Price in minor currency units (e.g. cents). Null = "Ask for price". */
  priceCents: number | null;
}

export interface PublicStaffMember {
  id: string;
  displayName: string;
  serviceIds: string[];
}

export interface PublicAvailabilitySlot {
  startUtc: string;
  endUtc: string;
  displayTime: string;
  anyStaffAvailable?: boolean;
}

export interface PublicAvailabilityResponse {
  date: string;
  slots: PublicAvailabilitySlot[];
}

export interface BookingConfirmation {
  bookingId: string;
  startAt: string;
  endAt: string;
  staffMemberId: string;
  serviceId: string;
  customerId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
}

export interface OtpConfirmResponse {
  grantToken: string;
  expiresAt: string;
}

// Re-export inputs from the shared schema so consumers have one place to import.
export type {
  BookingRequestInput,
  GuestOtpConfirmInput,
  GuestOtpRequestInput,
};

// ---------------------------------------------------------------------------
// API error envelope (matches the API's AllExceptionsFilter shape).
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
}
