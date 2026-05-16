import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

export interface AuditEntry {
  /**
   * Dotted action namespace, e.g. "tenant.create", "tenant.suspend",
   * "tenant.settings.update". Keep stable — log shippers and dashboards
   * pivot on this field.
   */
  action: string;
  /** Who performed the action. Null for system events (rare). */
  actorUserId?: string | null;
  /** Tenant the action concerns. Null for platform-wide events. */
  tenantId?: string | null;
  /**
   * Free-form context for forensics. Never include passwords/secrets, even
   * hashed — the audit log is intentionally easier to read than the rest
   * of the data store.
   */
  metadata?: Record<string, unknown>;
}

/**
 * DB-backed audit trail (Step 6).
 *
 * Design rules:
 *   • A failed audit write MUST NOT block the user-facing action. We log
 *     to stdout as a backup and swallow the error. State-change endpoints
 *     are already protected by transactions; the audit is an extra trail.
 *   • Stdout logs use a kind="audit" JSON line for trivial ingestion.
 *   • This service is the SINGLE writer of `audit_logs`. Routes that need
 *     booking-specific context (linking to a booking row) keep using
 *     `BookingAuditLog` — those two live side by side intentionally.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    const metadata = (entry.metadata ?? {}) as Prisma.JsonObject;

    // Stdout log is sync-ish (single console call) so it's recorded even
    // when the DB write below errors.
    this.logger.log(
      JSON.stringify({
        kind: "audit",
        timestamp: new Date().toISOString(),
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        tenantId: entry.tenantId ?? null,
        metadata,
      }),
    );

    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorUserId: entry.actorUserId ?? null,
          tenantId: entry.tenantId ?? null,
          metadata,
        },
      });
    } catch (err) {
      this.logger.error(
        `Audit DB write failed for action=${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
