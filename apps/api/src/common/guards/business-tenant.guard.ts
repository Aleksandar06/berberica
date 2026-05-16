import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../types/request-user.types";
import type { TenantContext } from "../types/tenant-context.types";

/**
 * Tenant selector header for users belonging to multiple tenants.
 *
 * Why a header (not a body field or a path param)?
 *   • Body  → forbidden by spec. Body `tenant_id` is NEVER trusted.
 *   • Path  → would pollute every business route with `:tenantSlug`. The
 *             session-resolved model is more ergonomic for the dashboard.
 *   • Header → set once by the dashboard's "active workspace" switcher,
 *             every request carries it transparently. The server validates
 *             the header against the user's `memberships` on every call —
 *             a forged header value that isn't a membership = 403.
 */
const TENANT_SELECTOR_HEADER = "x-tenant-slug";

/**
 * Resolves the active tenant for `/api/business/...` routes from the
 * authenticated session.
 *
 * Rules:
 *   • Caller must be authenticated (JwtAuthGuard provides `req.user`).
 *   • Only TENANT_ADMIN, STAFF, or SUPER_ADMIN memberships qualify a tenant
 *     for the business dashboard. CUSTOMER role does NOT — customers use
 *     `/api/me/...` routes instead (added later).
 *   • Exactly one qualifying membership → that's the active tenant.
 *   • Multiple qualifying memberships → require `X-Tenant-Slug` header.
 *     The header MUST match the slug of one of the user's memberships.
 *   • Zero qualifying memberships → 403.
 *
 * Attaches `req.tenant` with `source: "business"`.
 */
@Injectable()
export class BusinessTenantGuard implements CanActivate {
  // Roles that grant business-dashboard access.
  private static readonly BUSINESS_ROLES: ReadonlyArray<Role> = [
    Role.TENANT_ADMIN,
    Role.STAFF,
    Role.SUPER_ADMIN,
  ];

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: RequestUser }>();

    const user = req.user;
    if (!user) {
      // JwtAuthGuard should have populated this. Defensive throw.
      throw new UnauthorizedException("Authentication required");
    }

    const qualifying = user.memberships.filter((m) =>
      BusinessTenantGuard.BUSINESS_ROLES.includes(m.role),
    );

    if (qualifying.length === 0) {
      throw new ForbiddenException("No business membership");
    }

    let chosen: { tenantId: string };
    if (qualifying.length === 1) {
      chosen = qualifying[0]!;
    } else {
      const headerSlug = headerString(req, TENANT_SELECTOR_HEADER);
      if (!headerSlug) {
        throw new ForbiddenException(
          `Multiple memberships — supply ${TENANT_SELECTOR_HEADER} header`,
        );
      }
      // Resolve slug → tenantId, then verify it's one of the user's memberships.
      const tenant = await this.prisma.tenant.findFirst({
        where: { slug: headerSlug.toLowerCase() },
        select: { id: true },
      });
      if (!tenant) {
        throw new ForbiddenException("Unknown tenant");
      }
      const match = qualifying.find((m) => m.tenantId === tenant.id);
      if (!match) {
        // Header named a real tenant the user is NOT a member of.
        throw new ForbiddenException("Not a member of selected tenant");
      }
      chosen = match;
    }

    // We re-fetch the tenant row (cheap, indexed) to get slug+status — the
    // session payload only stores tenantId, and we want the full context.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: chosen.tenantId },
      select: { id: true, slug: true, status: true },
    });
    if (!tenant) {
      // Tenant was deleted between session issue and now.
      throw new ForbiddenException("Tenant not available");
    }
    if (tenant.status === "suspended") {
      throw new ForbiddenException("Tenant suspended");
    }

    const ctx: TenantContext = {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
      source: "business",
    };
    req.tenant = ctx;
    return true;
  }
}

function headerString(
  req: FastifyRequest,
  name: string,
): string | undefined {
  const v = req.headers[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}
