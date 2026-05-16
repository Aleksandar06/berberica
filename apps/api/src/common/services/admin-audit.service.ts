import { Injectable, Logger } from "@nestjs/common";

/**
 * Audit trail for SUPER_ADMIN actions that touch tenant data.
 *
 * Today: structured pino-style log lines (visible in dev output).
 * Step 6 wires the audit-log persistence to `booking_audit_logs` or a new
 * `admin_audit_logs` table — TBD when we have a clearer schema for that.
 *
 * This stub exists now so AdminTenantGuard and any future admin endpoints
 * can call `recordAccess(...)` without changing later.
 */
export interface AdminAuditEntry {
  actorUserId: string;
  actorEmail: string;
  tenantId: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger("AdminAudit");

  recordAccess(entry: AdminAuditEntry): void {
    // JSON line so log shippers can ingest it directly.
    this.logger.log(
      JSON.stringify({
        kind: "admin_audit",
        timestamp: new Date().toISOString(),
        ...entry,
      }),
    );
  }
}
