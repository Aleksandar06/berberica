import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { TenantContext } from "../types/tenant-context.types";

/**
 * Extracts the `TenantContext` attached by a tenant guard. Always returns a
 * non-null value: if the guard didn't run, the route is misconfigured and
 * we throw a 500 immediately rather than letting callers see a nullable
 * tenant they might forget to check.
 *
 * Use only on routes guarded by PublicTenantGuard, BusinessTenantGuard, or
 * AdminTenantGuard. The compile-time signature reflects the runtime guarantee.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!req.tenant) {
      throw new InternalServerErrorException(
        "@CurrentTenant() used on a route without a tenant guard",
      );
    }
    return req.tenant;
  },
);
