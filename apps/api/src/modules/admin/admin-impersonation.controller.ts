import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { AuditLogService } from "../../common/services/audit-log.service";
import type { RequestUser } from "../../common/types/request-user.types";

interface ImpersonationRequestBody {
  /** Target TENANT_ADMIN user id. */
  userId: string;
  reason?: string;
}

/**
 * SUPER_ADMIN impersonation — STUB.
 *
 * Decision: full impersonation UX is deferred past MVP.
 *
 * Why: securely issuing tokens that act as another user requires:
 *   • A distinct JWT subtype with `impersonatedBy`/`impersonationId` claims,
 *   • UI banners on every page so the operator can never forget they are
 *     impersonating,
 *   • Audit trail on every action taken during impersonation (not just on
 *     the impersonation request itself),
 *   • Tight time bound (~5 min) + manual end-impersonation endpoint,
 *   • Forbidden-actions list (e.g. cannot change passwords or 2FA).
 *
 * Building that without a strong product reason invites footguns. Until
 * customer support actually needs it, the endpoint records the attempt
 * (so we have evidence of any abuse) and returns 501.
 *
 * Keeping the route shape stable lets the frontend wire the "impersonate"
 * button today; the server just declines.
 */
@UseGuards(SuperAdminGuard)
@Controller("admin/tenants")
export class AdminImpersonationController {
  constructor(private readonly audit: AuditLogService) {}

  @Post(":id/impersonate")
  async impersonate(
    @Param("id", new ParseUUIDPipe()) tenantId: string,
    @Body() body: ImpersonationRequestBody,
    @CurrentUser() user: RequestUser,
  ): Promise<never> {
    await this.audit.record({
      action: "admin.impersonate.attempt",
      actorUserId: user.userId,
      tenantId,
      metadata: {
        actorEmail: user.email,
        targetUserId: body.userId,
        reason: body.reason ?? null,
        status: "not_implemented",
      },
    });
    throw new HttpException(
      {
        code: "NOT_IMPLEMENTED",
        message:
          "Impersonation is intentionally not implemented in MVP. See AdminImpersonationController for rationale.",
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
