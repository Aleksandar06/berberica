import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AuditLogService } from "../../common/services/audit-log.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  compareSecret,
  generateAccountToken,
  hashSecret,
} from "./verification-crypto";

const ACCOUNT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface IssuedAccountToken {
  /** Raw token — included in the notification payload, never persisted. */
  token: string;
  expiresAt: Date;
}

/**
 * Account-email verification (registered users only). Tokens are 384-bit
 * randoms, SHA-256 hashed at rest, single-use, 24-hour expiry.
 *
 * Idempotency: every issue() invalidates this user's prior unconsumed
 * account-email codes — only the latest link works.
 */
@Injectable()
export class AccountVerificationService {
  private readonly logger = new Logger(AccountVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Issue a fresh verification token and enqueue the email notification.
   * Wraps both in a transaction so a notification write failure rolls back
   * the code row (otherwise the user could never re-trigger).
   */
  async issue(email: string): Promise<IssuedAccountToken> {
    const normEmail = email.toLowerCase().trim();
    const token = generateAccountToken();
    const codeHash = hashSecret(token);
    const expiresAt = new Date(Date.now() + ACCOUNT_TOKEN_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      // Invalidate prior unconsumed tokens for this email.
      await tx.verificationCode.updateMany({
        where: {
          targetEmail: normEmail,
          purpose: "account_email",
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.verificationCode.create({
        data: {
          purpose: "account_email",
          targetEmail: normEmail,
          codeHash,
          expiresAt,
        },
      });
      // Notification — payload carries the RAW token (Step 14's email channel
      // turns it into a verify-email link). Sensitive: production log
      // shippers MUST redact `payload.token`.
      await tx.notificationEvent.create({
        data: {
          type: "auth.verify_email",
          status: "pending",
          payload: {
            email: normEmail,
            token,
            expiresAt: expiresAt.toISOString(),
          } as Prisma.JsonObject,
        },
      });
    });

    return { token, expiresAt };
  }

  /**
   * Consume a verification token. Marks the user `email_verified=true`.
   *
   * Anti-enumeration: returns a generic boolean — the caller MUST emit the
   * same response shape whether the token was valid or not.
   */
  async consume(rawToken: string): Promise<{ ok: boolean; userId?: string }> {
    const codeHash = hashSecret(rawToken);
    const row = await this.prisma.verificationCode.findFirst({
      where: {
        purpose: "account_email",
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) return { ok: false };

    const user = await this.prisma.user.findUnique({
      where: { email: row.targetEmail },
      select: { id: true, emailVerified: true },
    });
    if (!user) {
      // Token references an email that's been deleted — burn the row anyway.
      await this.prisma.verificationCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      return { ok: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationCode.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      if (!user.emailVerified) {
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
        });
      }
    });

    await this.audit.record({
      action: "account.email_verified",
      actorUserId: user.id,
      metadata: { email: row.targetEmail },
    });
    return { ok: true, userId: user.id };
  }

  /**
   * Resend the verification email for an unverified user. Caller emits the
   * SAME response whether the email exists or is already verified — this
   * function just no-ops in those cases.
   */
  async resend(email: string): Promise<void> {
    const normEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normEmail },
      select: { emailVerified: true },
    });
    if (!user || user.emailVerified) return;
    await this.issue(normEmail);
  }

  /** Belt-and-suspenders sanity for ad-hoc admin tooling. */
  static compare(rawToken: string, storedHashHex: string): boolean {
    return compareSecret(rawToken, storedHashHex);
  }
}
