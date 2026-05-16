import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TenantStatus } from "@prisma/client";
import Redis from "ioredis";

import type { RedisConfig } from "../config/configuration";

/** Slim cached projection of a tenant — enough for slug → context lookup. */
export interface CachedTenant {
  id: string;
  slug: string;
  status: TenantStatus;
}

/**
 * Redis-backed cache for public tenant lookups by slug.
 *
 * Why cache: public storefront pages hit `/api/public/:slug/...` on every
 * request, and the slug → tenant lookup is on the hot path of every page.
 * The lookup itself is one indexed Postgres row but Redis is sub-millisecond.
 *
 * TTL is intentionally short (60s) so admin edits propagate quickly even
 * without an explicit invalidate call. Edits SHOULD also call invalidate(slug)
 * for instant propagation — Step 6 (tenant admin endpoints) wires that.
 */
@Injectable()
export class TenantCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantCacheService.name);
  private readonly client: Redis;
  private readonly ttlSec = 60;

  constructor(config: ConfigService) {
    const redis = config.get<RedisConfig>("redis");
    if (!redis) throw new Error("Redis config missing");
    this.client = new Redis(redis.url, {
      // Don't crash the API if Redis is down — fall back to Postgres.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.client.on("error", (err) =>
      this.logger.warn(`Redis error (will fall back to DB): ${err.message}`),
    );
  }

  async getBySlug(slug: string): Promise<CachedTenant | null> {
    try {
      const raw = await this.client.get(this.key(slug));
      return raw ? (JSON.parse(raw) as CachedTenant) : null;
    } catch {
      // Cache-miss-on-error: caller will hit Postgres.
      return null;
    }
  }

  async set(tenant: CachedTenant): Promise<void> {
    try {
      await this.client.set(
        this.key(tenant.slug),
        JSON.stringify(tenant),
        "EX",
        this.ttlSec,
      );
    } catch {
      // Non-fatal — next request will just re-fetch from DB.
    }
  }

  /**
   * Invalidate a slug's cache entry. Call from any admin endpoint that
   * mutates tenant identity (name, slug change, status flip).
   */
  async invalidate(slug: string): Promise<void> {
    try {
      await this.client.del(this.key(slug));
    } catch {
      /* ignore */
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  private key(slug: string): string {
    return `tenant:slug:${slug.toLowerCase()}`;
  }
}
