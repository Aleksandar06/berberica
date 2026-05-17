import {
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AuditLogService } from "../../common/services/audit-log.service";
import { NotificationDispatcherService } from "../notifications/notification-dispatcher.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  compareSecret,
  generateGrantToken,
  generateOtp,
  hashIntent,
  hashSecret,
} from "./verification-crypto";

const OTP_TTL_MS = 10 * 60 * 1000;       // 10 minutes
const GRANT_TTL_MS = 15 * 60 * 1000;     // 15 minutes
const MAX_OTP_ATTEMPTS = 5;

export interface OtpRequestArgs {
  tenantId: string;
  email: string;
  serviceId: string;
  staffId: string;
  startAt: string;
}

export interface OtpConfirmArgs extends OtpRequestArgs {
  code: string;
}

export interface IssuedGrant {
  grantToken: string;
  expiresAt: Date;
}

export interface ResolvedGrant {
  id: string;
  tenantId: string;
  targetEmail: string;
  expiresAt: Date;
}

/**
 * Guest-booking OTP + grant lifecycle.
 *
 *   request(...)  → invalidate prior unconsumed OTPs for (tenant, email,
 *                   intent), insert a fresh 6-digit code (hashed), enqueue
 *                   notification. Returns nothing — anti-enumeration.
 *
 *   confirm(...)  → constant-time compare against the active OTP row;
 *                   increment attempt counter on miss; lock after N misses
 *                   by marking the row consumed; on success, mark the OTP
 *                   consumed AND emit a single-use `guest_grant` row bound
 *                   to (tenant, email).
 *
 *   resolveGrant() → look up an active grant by raw token + tenant + email
 *                   (no enumeration leak; missing → throw).
 *
 *   consumeGrant() → mark a grant consumed. Called by the booking TX AFTER
 *                   the booking insert succeeds, so a 409 leaves the grant
 *                   intact for retry with a new slot.
 *
 * Grants are intentionally bound to (tenant, email) ONLY — NOT to a specific
 * slot. A guest who passes OTP for slot X but loses the race to another
 * booking can pick slot Y without re-verifying. Intent metadata is captured
 * via audit_logs, not on the grant row.
 */
@Injectable()
export class BookingVerificationService {
  private readonly logger = new Logger(BookingVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  // ---------------------------------------------------------------------------
  // REQUEST
  // ---------------------------------------------------------------------------

  async request(args: OtpRequestArgs): Promise<void> {
    const normEmail = args.email.toLowerCase().trim();
    const intentHash = hashIntent({
      tenantId: args.tenantId,
      serviceId: args.serviceId,
      staffId: args.staffId,
      startAt: args.startAt,
    });
    const code = generateOtp();
    const codeHash = hashSecret(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const notificationId = await this.prisma.$transaction(async (tx) => {
      // Idempotency: invalidate prior unconsumed OTPs for the exact intent.
      await tx.verificationCode.updateMany({
        where: {
          tenantId: args.tenantId,
          targetEmail: normEmail,
          purpose: "guest_otp",
          intentHash,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.verificationCode.create({
        data: {
          tenantId: args.tenantId,
          purpose: "guest_otp",
          targetEmail: normEmail,
          codeHash,
          intentHash,
          expiresAt,
        },
      });
      const notification = await tx.notificationEvent.create({
        data: {
          tenantId: args.tenantId,
          type: "booking.verify_otp",
          status: "pending",
          payload: {
            email: normEmail,
            code, // production log shippers MUST redact `payload.code`
            expiresAt: expiresAt.toISOString(),
            // Intent recorded for audit so the email can mention what's
            // being verified ("verify your booking for Service X at HH:mm").
            intent: {
              serviceId: args.serviceId,
              staffId: args.staffId,
              startAt: args.startAt,
            },
          } as Prisma.JsonObject,
        },
        select: { id: true },
      });
      return notification.id;
    });

    // Send the OTP email AFTER the transaction commits so a Resend hiccup
    // can't roll back the verification row. The dispatcher marks the event
    // failed on error; users still see the generic 200 and can re-request.
    await this.dispatcher.dispatch(notificationId);

    await this.audit.record({
      action: "verification.guest_otp_issued",
      tenantId: args.tenantId,
      metadata: {
        email: normEmail,
        // Never log the code itself.
        intent: {
          serviceId: args.serviceId,
          staffId: args.staffId,
          startAt: args.startAt,
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // CONFIRM
  // ---------------------------------------------------------------------------

  async confirm(args: OtpConfirmArgs): Promise<IssuedGrant> {
    const normEmail = args.email.toLowerCase().trim();
    const intentHash = hashIntent({
      tenantId: args.tenantId,
      serviceId: args.serviceId,
      staffId: args.staffId,
      startAt: args.startAt,
    });

    const row = await this.prisma.verificationCode.findFirst({
      where: {
        tenantId: args.tenantId,
        targetEmail: normEmail,
        purpose: "guest_otp",
        intentHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row) {
      // Missing OR expired OR already consumed — uniform 403.
      throw new ForbiddenException({
        code: "OTP_INVALID",
        message: "That code is invalid or expired. Request a new one.",
      });
    }
    if (row.attemptCount >= MAX_OTP_ATTEMPTS) {
      // Already locked from prior misses. Force re-request.
      await this.prisma.verificationCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      throw new ForbiddenException({
        code: "OTP_LOCKED",
        message: "Too many attempts. Request a new code.",
      });
    }

    const ok = compareSecret(args.code, row.codeHash);
    if (!ok) {
      const nextAttempt = row.attemptCount + 1;
      const lock = nextAttempt >= MAX_OTP_ATTEMPTS;
      await this.prisma.verificationCode.update({
        where: { id: row.id },
        data: {
          attemptCount: nextAttempt,
          // Burn the row on the locking attempt so subsequent confirms
          // can't squeeze in.
          consumedAt: lock ? new Date() : undefined,
        },
      });
      throw new ForbiddenException({
        code: lock ? "OTP_LOCKED" : "OTP_INVALID",
        message: lock
          ? "Too many attempts. Request a new code."
          : "That code is invalid or expired. Request a new one.",
      });
    }

    // Success — burn the OTP, issue the grant.
    const grantToken = generateGrantToken();
    const grantCodeHash = hashSecret(grantToken);
    const grantExpiresAt = new Date(Date.now() + GRANT_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      await tx.verificationCode.create({
        data: {
          tenantId: args.tenantId,
          purpose: "guest_grant",
          targetEmail: normEmail,
          codeHash: grantCodeHash,
          // Grants are tenant+email scoped only; intent stays null.
          intentHash: null,
          expiresAt: grantExpiresAt,
        },
      });
    });

    await this.audit.record({
      action: "verification.guest_otp_confirmed",
      tenantId: args.tenantId,
      metadata: {
        email: normEmail,
        intent: {
          serviceId: args.serviceId,
          staffId: args.staffId,
          startAt: args.startAt,
        },
      },
    });

    return { grantToken, expiresAt: grantExpiresAt };
  }

  // ---------------------------------------------------------------------------
  // GRANT VALIDATION (used by BookingTransactionService)
  // ---------------------------------------------------------------------------

  /**
   * Look up an active grant by raw token. Validates tenant + email match.
   * Throws 403 on miss — caller never reveals whether a grant exists.
   *
   * Read-only (does NOT consume); the booking TX consumes once it has
   * committed the booking row.
   */
  async resolveGrant(args: {
    rawGrantToken: string;
    tenantId: string;
    expectedEmail: string;
  }): Promise<ResolvedGrant> {
    const codeHash = hashSecret(args.rawGrantToken);
    const normEmail = args.expectedEmail.toLowerCase().trim();
    const row = await this.prisma.verificationCode.findFirst({
      where: {
        purpose: "guest_grant",
        tenantId: args.tenantId,
        targetEmail: normEmail,
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before completing this booking.",
      });
    }
    return {
      id: row.id,
      tenantId: row.tenantId!,
      targetEmail: row.targetEmail,
      expiresAt: row.expiresAt,
    };
  }

  /**
   * Mark a grant consumed. Called by the booking TX AFTER the booking
   * insert succeeds. Idempotent — re-consuming is a no-op.
   *
   * Operates on a passed-in Prisma client so the caller can include this
   * in the same SERIALIZABLE transaction.
   */
  async consumeGrant(
    client: Prisma.TransactionClient | PrismaService,
    grantId: string,
  ): Promise<void> {
    const target = client as Prisma.TransactionClient;
    await target.verificationCode.updateMany({
      where: { id: grantId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
