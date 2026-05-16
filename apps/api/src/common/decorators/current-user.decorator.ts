import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { RequestUser } from "../types/request-user.types";

/**
 * Extracts the authenticated user that JwtStrategy.validate() attached to
 * `request.user`. Throws nothing — controllers using this on protected routes
 * are guaranteed a user by JwtAuthGuard. On @Public routes, the value may
 * be undefined; type the param as `RequestUser | undefined` in that case.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: RequestUser }>();
    return req.user;
  },
);
