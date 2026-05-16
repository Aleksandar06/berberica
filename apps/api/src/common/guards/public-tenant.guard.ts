import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RESERVED_SLUGS, SLUG_REGEX } from "@scheduling/schemas";
import type { FastifyRequest } from "fastify";

import { PrismaService } from "../../prisma/prisma.service";
import {
  type CachedTenant,
  TenantCacheService,
} from "../services/tenant-cache.service";
import type { TenantContext } from "../types/tenant-context.types";

/**
 * Resolves the tenant for `/api/public/:tenantSlug/...` routes.
 *
 * Order:
 *   1. Read path param `tenantSlug`.
 *   2. Reject if format-invalid or in the reserved list (both → 404,
 *      generic message: cannot reveal a slug is "taken" for system reasons).
 *   3. Redis cache lookup; cache miss falls back to Postgres.
 *   4. If absent → 404 (no existence leak).
 *   5. If suspended → 403 with structured TENANT_SUSPENDED contract.
 *   6. Attach TenantContext to request.
 *
 * Route handlers MUST be `@Public()` (skips JwtAuthGuard) AND mounted under
 * a controller that lists `tenantSlug` as a route parameter:
 *
 *   @Controller("public/:tenantSlug/services")
 *   @UseGuards(PublicTenantGuard)
 *   export class ... {}
 */
@Injectable()
export class PublicTenantGuard implements CanActivate {
  constructor(
    private readonly cache: TenantCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const params = req.params as Record<string, string | undefined>;
    const rawSlug = params.tenantSlug;

    if (typeof rawSlug !== "string" || rawSlug.length === 0) {
      throw new NotFoundException("Not found");
    }

    const slug = rawSlug.toLowerCase();

    // Defense-in-depth: the same checks run in @scheduling/schemas slugSchema
    // for create flows, but we re-check here because path params are not
    // validated by the global ZodValidationPipe.
    if (
      !SLUG_REGEX.test(slug) ||
      (RESERVED_SLUGS as readonly string[]).includes(slug)
    ) {
      throw new NotFoundException("Not found");
    }

    let tenant: CachedTenant | null = await this.cache.getBySlug(slug);
    if (!tenant) {
      const row = await this.prisma.tenant.findFirst({
        where: { slug },
        select: { id: true, slug: true, status: true },
      });
      if (!row) {
        throw new NotFoundException("Not found");
      }
      tenant = row;
      await this.cache.set(tenant);
    }

    if (tenant.status === "suspended") {
      // Distinct status — the storefront renders a "this business is
      // currently unavailable" page based on the TENANT_SUSPENDED code.
      throw new HttpException(
        {
          code: "TENANT_SUSPENDED",
          message: "This business is currently unavailable.",
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const ctx: TenantContext = {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
      source: "public",
    };
    req.tenant = ctx;
    return true;
  }
}
