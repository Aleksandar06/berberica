/**
 * Authenticated admin endpoints (SUPER_ADMIN only). All routes mounted at
 * /api/admin/* — the SuperAdminGuard rejects callers without the role.
 */
import { authedFetch } from "./authed-client";

export type TenantStatus = "active" | "suspended";

export interface AdminTenantListItem {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  timezone: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTenantsListResponse {
  items: AdminTenantListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminTenantDetail extends AdminTenantListItem {
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  settings: {
    defaultSlotDurationMinutes: number;
    bookingLeadTimeMinutes: number;
    bookingMaxDaysAhead: number;
    allowGuestBooking: boolean;
    allowCustomerCancellation: boolean;
    allowCustomerReschedule: boolean;
  } | null;
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  } | null;
  _count: {
    userRoles: number;
    services: number;
    staffMembers: number;
    bookings: number;
  };
}

export interface CreateTenantResponse {
  tenant: AdminTenantListItem;
  admin: {
    userId: string;
    email: string;
    initialPassword: string;
  };
}

export interface PlatformAnalytics {
  tenants: { total: number; active: number; suspended: number };
  users: { total: number };
  services: { total: number };
  staff: { total: number };
  bookings: { total: number; byStatus: Record<string, number> };
  generatedAt: string;
}

export const adminApi = {
  listTenants(params: {
    page?: number;
    pageSize?: number;
    status?: TenantStatus;
    search?: string;
  }): Promise<AdminTenantsListResponse> {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? 1));
    qs.set("pageSize", String(params.pageSize ?? 20));
    if (params.status) qs.set("status", params.status);
    if (params.search) qs.set("search", params.search);
    return authedFetch(`/api/admin/tenants?${qs.toString()}`);
  },
  getTenant(id: string): Promise<AdminTenantDetail> {
    return authedFetch(`/api/admin/tenants/${id}`);
  },
  createTenant(input: {
    name: string;
    slug: string;
    businessType: string;
    timezone: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    adminEmail: string;
    adminFirstName?: string;
    adminLastName?: string;
  }): Promise<CreateTenantResponse> {
    return authedFetch("/api/admin/tenants", { method: "POST", body: input });
  },
  updateTenant(
    id: string,
    input: Partial<{
      name: string;
      businessType: string;
      timezone: string;
      contactEmail: string | null;
      contactPhone: string | null;
      address: string | null;
    }>,
  ): Promise<AdminTenantDetail> {
    return authedFetch(`/api/admin/tenants/${id}`, {
      method: "PATCH",
      body: input,
    });
  },
  suspendTenant(id: string, reason?: string): Promise<AdminTenantListItem> {
    return authedFetch(`/api/admin/tenants/${id}/suspend`, {
      method: "POST",
      body: { reason },
    });
  },
  reactivateTenant(id: string, reason?: string): Promise<AdminTenantListItem> {
    return authedFetch(`/api/admin/tenants/${id}/reactivate`, {
      method: "POST",
      body: { reason },
    });
  },
  analytics(): Promise<PlatformAnalytics> {
    return authedFetch("/api/admin/analytics");
  },
};
