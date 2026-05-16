import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import type { RequestUser } from "../types/request-user.types";

/**
 * Gate for `/api/admin/...` routes. Requires SUPER_ADMIN in any membership
 * (the role is platform-scope, not tenant-scope). Does NOT attach a tenant
 * context — admin routes either don't need one (analytics) or use
 * AdminTenantGuard for tenant-data views.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
    return true;
  }
}
