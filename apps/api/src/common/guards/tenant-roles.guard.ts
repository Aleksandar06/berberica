import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { ROLES_KEY } from "../decorators/roles.decorator";
import type { RequestUser } from "../types/request-user.types";

/**
 * Stricter sibling of the Step-4 RolesGuard. Both read `@Roles(...)` metadata,
 * but TenantRolesGuard requires that the user hold the role in the *resolved
 * tenant* — not just in any tenant.
 *
 *   RolesGuard         → checks user has role X in ANY membership
 *   TenantRolesGuard   → checks user has role X in req.tenant.id specifically
 *
 * Place AFTER BusinessTenantGuard so `req.tenant` is populated:
 *
 *   @UseGuards(BusinessTenantGuard, TenantRolesGuard)
 *   @Roles(Role.TENANT_ADMIN)
 *   @Get("settings")
 *
 * SUPER_ADMIN bypass: a user with SUPER_ADMIN in ANY membership passes any
 * role check — they're the platform owner.
 */
@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ReadonlyArray<Role>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: RequestUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException("Authentication required");
    }
    if (!req.tenant) {
      // Misconfiguration: TenantRolesGuard must run after a tenant guard.
      throw new InternalServerErrorException(
        "TenantRolesGuard requires a tenant context — apply a tenant guard first",
      );
    }

    // SUPER_ADMIN bypass — they're platform-scope, not tenant-scope.
    if (user.memberships.some((m) => m.role === Role.SUPER_ADMIN)) {
      return true;
    }

    const membership = user.memberships.find(
      (m) => m.tenantId === req.tenant!.id,
    );
    if (!membership) {
      throw new ForbiddenException("Not a member of this tenant");
    }
    if (!required.includes(membership.role)) {
      throw new ForbiddenException("Insufficient role for this tenant");
    }
    return true;
  }
}
