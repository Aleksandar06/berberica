import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { PrismaService } from "../../prisma/prisma.service";
import { AdminAuditService } from "../services/admin-audit.service";
import type { RequestUser } from "../types/request-user.types";
import type { TenantContext } from "../types/tenant-context.types";

/**
 * Resolves the target tenant for SUPER_ADMIN tenant-data access via
 * `/api/admin/tenants/:tenantId/...`. Unlike BusinessTenantGuard, this does
 * NOT consult the user's memberships — SUPER_ADMINs can see any tenant by
 * design.
 *
 * Every successful resolution writes an audit log entry. Failures (404)
 * are NOT logged with the requested tenant id to avoid making the audit log
 * itself a leak vector.
 */
@Injectable()
export class AdminTenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: RequestUser }>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }
    if (!user.memberships.some((m) => m.role === Role.SUPER_ADMIN)) {
      throw new ForbiddenException("Super admin only");
    }

    // Accept either `:tenantId` (verbose, explicit) or `:id` (RESTful
    // shorthand). Admin endpoints in Step 6 use `:id`; the original Step-5
    // demos used `:tenantId`. Both are valid.
    const params = req.params as Record<string, string | undefined>;
    const tenantId = params.tenantId ?? params.id;
    if (typeof tenantId !== "string" || tenantId.length === 0) {
      throw new NotFoundException("Not found");
    }
    // Basic UUID shape check before hitting the DB; saves a query on garbage.
    if (!UUID_REGEX.test(tenantId)) {
      throw new NotFoundException("Not found");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException("Not found");
    }

    const ctx: TenantContext = {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
      source: "admin",
    };
    req.tenant = ctx;

    this.audit.recordAccess({
      actorUserId: user.userId,
      actorEmail: user.email,
      tenantId: tenant.id,
      action: "admin.tenant.access",
      resource: req.url,
    });

    return true;
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
