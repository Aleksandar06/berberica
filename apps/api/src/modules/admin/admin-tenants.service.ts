import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role, type Tenant, type TenantStatus } from "@prisma/client";
import type {
  AdminCreateTenantInput,
  AdminListTenantsQuery,
  TenantUpdateInput,
} from "@scheduling/schemas";
import { RESERVED_SLUGS } from "@scheduling/schemas";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantCacheService } from "../../common/services/tenant-cache.service";
import { hashPassword } from "../auth/argon2.helper";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateTenantResult {
  tenant: Tenant;
  admin: {
    userId: string;
    email: string;
    /**
     * Generated initial password, returned ONCE. Super admin records it and
     * shares out-of-band with the tenant owner; the platform never stores
     * the plaintext beyond this response payload.
     */
    initialPassword: string;
  };
}

@Injectable()
export class AdminTenantsService {
  private readonly logger = new Logger(AdminTenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TenantCacheService,
    private readonly audit: AuditLogService,
  ) {}

  // -------------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------------

  async list(query: AdminListTenantsQuery) {
    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      const term = query.search;
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term.toLowerCase() } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          slug: true,
          name: true,
          businessType: true,
          timezone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  async getOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        settings: true,
        branding: true,
        _count: {
          select: {
            userRoles: true,
            services: true,
            staffMembers: true,
            bookings: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Not found");
    }
    return tenant;
  }

  // -------------------------------------------------------------------------
  // CREATE
  //
  // Transactional. Steps:
  //   1. Re-check slug isn't reserved (Zod already did; defense in depth).
  //   2. Atomically create tenant + settings + branding + admin user + role.
  //   3. Audit the creation (with no password fields).
  //   4. Return the tenant + the one-time initial admin password.
  //
  // Initial-password strategy:
  //   • 16 bytes (128 bits) random, base64url-encoded → ~22 chars.
  //   • Argon2id-hashed for storage; plaintext returned ONCE in the
  //     response. The super admin shares it with the tenant owner out of
  //     band. Step 11A's email-verification flow lets the owner replace
  //     it. We could email a reset token instead, but we don't have email
  //     wiring yet (Step 14) — show-once-then-discard is the safest MVP.
  // -------------------------------------------------------------------------

  async create(
    input: AdminCreateTenantInput,
    actor: { userId: string; email: string },
  ): Promise<CreateTenantResult> {
    if ((RESERVED_SLUGS as readonly string[]).includes(input.slug)) {
      throw new BadRequestException("Slug is reserved");
    }

    // Pre-checks before opening the transaction — friendly 409s instead of
    // a generic FK-failure message.
    const existingSlug = await this.prisma.tenant.findFirst({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existingSlug) throw new ConflictException("Slug already taken");
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.adminEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException("A user with the admin email already exists");
    }

    const initialPassword = randomBytes(16).toString("base64url");
    const passwordHash = await hashPassword(initialPassword);

    const { tenant, adminUser } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          businessType: input.businessType,
          timezone: input.timezone,
          contactEmail: input.contactEmail ?? null,
          contactPhone: input.contactPhone ?? null,
          address: input.address ?? null,
          settings: { create: {} },
          branding: { create: {} },
        },
      });
      const adminUser = await tx.user.create({
        data: {
          email: input.adminEmail,
          passwordHash,
          firstName: input.adminFirstName ?? null,
          lastName: input.adminLastName ?? null,
          emailVerified: false, // Step 11A flips this on verification.
        },
      });
      await tx.tenantUserRole.create({
        data: {
          tenantId: tenant.id,
          userId: adminUser.id,
          role: Role.TENANT_ADMIN,
        },
      });
      return { tenant, adminUser };
    });

    await this.audit.record({
      action: "tenant.create",
      actorUserId: actor.userId,
      tenantId: tenant.id,
      metadata: {
        actorEmail: actor.email,
        slug: tenant.slug,
        adminEmail: adminUser.email,
        // never log the password (plaintext OR hash)
      },
    });

    // No previous cache entry (new tenant), but call invalidate for safety
    // — guarantees no stale data if a slug ever got cached during creation.
    await this.cache.invalidate(tenant.slug);

    return {
      tenant,
      admin: {
        userId: adminUser.id,
        email: adminUser.email,
        initialPassword,
      },
    };
  }

  // -------------------------------------------------------------------------
  // UPDATE
  //
  // Policy decision: slug is NOT editable here. Slug changes would break
  // public URLs, customer bookmarks, and cached redirects. If we ever need
  // slug rotation it gets its own endpoint with a redirect-aliases table —
  // out of scope for MVP. Hence `TenantUpdateInput` from the shared schema
  // has no `slug` field by design.
  // -------------------------------------------------------------------------

  async update(
    id: string,
    input: TenantUpdateInput,
    actor: { userId: string; email: string },
  ): Promise<Tenant> {
    const before = await this.prisma.tenant.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Not found");

    const data: Prisma.TenantUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.businessType !== undefined) data.businessType = input.businessType;
    if (input.timezone !== undefined) data.timezone = input.timezone;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.address !== undefined) data.address = input.address;

    const after = await this.prisma.tenant.update({ where: { id }, data });

    await this.audit.record({
      action: "tenant.update",
      actorUserId: actor.userId,
      tenantId: id,
      metadata: { actorEmail: actor.email, changed: diff(before, after) },
    });
    await this.cache.invalidate(after.slug);
    return after;
  }

  // -------------------------------------------------------------------------
  // SUSPEND / REACTIVATE
  //
  // Effect of suspend on in-flight bookings:
  //   • Existing bookings are NOT touched. Customer history remains visible
  //     to the customer; the tenant dashboard is unreachable.
  //   • Public storefront returns 403 TENANT_SUSPENDED (Step-5 contract),
  //     so new bookings are blocked.
  //   • Reactivate restores everything — no migration step needed because
  //     no rows were mutated.
  // -------------------------------------------------------------------------

  async setStatus(
    id: string,
    status: TenantStatus,
    reason: string | undefined,
    actor: { userId: string; email: string },
  ): Promise<Tenant> {
    const before = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true },
    });
    if (!before) throw new NotFoundException("Not found");
    if (before.status === status) return this.prisma.tenant.findUniqueOrThrow({ where: { id } });

    const after = await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });

    await this.audit.record({
      action: status === "suspended" ? "tenant.suspend" : "tenant.reactivate",
      actorUserId: actor.userId,
      tenantId: id,
      metadata: {
        actorEmail: actor.email,
        from: before.status,
        to: status,
        reason: reason ?? null,
      },
    });
    await this.cache.invalidate(before.slug);
    return after;
  }
}

/** Shallow before/after diff for audit metadata. Drops unchanged fields. */
function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after) as Array<keyof T>) {
    if (before[k] !== after[k]) {
      out[k as string] = { from: before[k], to: after[k] };
    }
  }
  return out;
}
