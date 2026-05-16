import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { ROLES_KEY } from "../decorators/roles.decorator";
import { type RequestUser, userHasAnyRole } from "../types/request-user.types";

/**
 * Checks @Roles(...) metadata. In Step 4 a user passes if they hold ANY
 * of the required roles across ALL their memberships. Step 5 will layer
 * a tenant-scoped version on top that further restricts to roles held in
 * the request's resolved tenant.
 */
@Injectable()
export class RolesGuard implements CanActivate {
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
      // Unreachable when JwtAuthGuard ran first. Defensive throw.
      throw new ForbiddenException("Authentication required");
    }

    // SUPER_ADMIN is platform-scope — bypasses every role check.
    // The TenantRolesGuard (Step 5) has the same bypass; keep them aligned.
    if (user.memberships.some((m) => m.role === Role.SUPER_ADMIN)) {
      return true;
    }

    if (!userHasAnyRole(user, required)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
