import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NotificationEvent, Prisma } from "@prisma/client";

import type { EmailConfig } from "../../common/config/configuration";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailSenderService } from "./email-sender.service";

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Picks a single pending NotificationEvent row, renders + sends the email,
 * and marks the row sent/failed. Idempotent on success — re-dispatching a
 * row that is no longer `pending` is a no-op.
 *
 * Today the only channel is email; SMS/push would slot in alongside as
 * additional senders behind a `channel` switch on the event type.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly webBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailSenderService,
    config: ConfigService,
  ) {
    const emailCfg = config.get<EmailConfig>("email");
    if (!emailCfg) throw new Error("Email config missing");
    this.webBaseUrl = emailCfg.webBaseUrl.replace(/\/$/, "");
  }

  /**
   * Best-effort dispatch by id. Designed to be called inline right after
   * the creator transaction commits. Swallows errors after marking the
   * row `failed` so the caller's user-facing flow is not impacted.
   */
  async dispatch(eventId: string): Promise<void> {
    const row = await this.prisma.notificationEvent.findUnique({
      where: { id: eventId },
    });
    if (!row || row.status !== "pending") return;

    try {
      const rendered = this.render(row);
      if (!rendered) {
        // Unknown type — leave it for an operator to inspect rather than
        // marking failed forever. Future channels can extend `render()`.
        this.logger.warn(
          `No renderer for notification type=${row.type} id=${row.id}`,
        );
        return;
      }
      const to = this.extractRecipient(row);
      if (!to) {
        await this.markFailed(row.id, "missing recipient email");
        return;
      }
      await this.email.send({ to, ...rendered });
      await this.prisma.notificationEvent.update({
        where: { id: row.id },
        data: { status: "sent" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to dispatch notification id=${row.id} type=${row.type}: ${msg}`,
      );
      await this.markFailed(row.id, msg);
    }
  }

  private async markFailed(id: string, _reason: string): Promise<void> {
    await this.prisma.notificationEvent.update({
      where: { id },
      data: { status: "failed" },
    });
  }

  private extractRecipient(row: NotificationEvent): string | null {
    const payload = row.payload as Prisma.JsonObject;
    const email = payload?.email;
    return typeof email === "string" && email.length > 0 ? email : null;
  }

  private render(row: NotificationEvent): RenderedEmail | null {
    const payload = row.payload as Prisma.JsonObject;
    switch (row.type) {
      case "booking.verify_otp":
        return this.renderBookingOtp(payload);
      case "auth.verify_email":
        return this.renderAccountVerify(payload);
      default:
        return null;
    }
  }

  private renderBookingOtp(payload: Prisma.JsonObject): RenderedEmail {
    const code = String(payload.code ?? "");
    const subject = `Your booking verification code: ${code}`;
    const text =
      `Your verification code is ${code}.\n\n` +
      `Enter this code in the booking form to confirm your appointment. ` +
      `The code expires in 10 minutes.\n\n` +
      `If you didn't request this code, you can safely ignore this email.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px;">Verify your booking</h2>
        <p>Enter this code in the booking form to confirm your appointment:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; background: #f4f4f5; padding: 16px; text-align: center; border-radius: 8px; margin: 24px 0;">${code}</p>
        <p style="color: #71717a; font-size: 14px;">The code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;
    return { subject, html, text };
  }

  private renderAccountVerify(payload: Prisma.JsonObject): RenderedEmail {
    const token = String(payload.token ?? "");
    const link = `${this.webBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = "Verify your Berberica email";
    const text =
      `Welcome to Berberica!\n\n` +
      `Confirm your email by opening this link:\n${link}\n\n` +
      `This link expires in 24 hours.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px;">Welcome to Berberica</h2>
        <p>Confirm your email address to finish setting up your account:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #18181b; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify email</a>
        </p>
        <p style="color: #71717a; font-size: 14px;">Or copy and paste this URL into your browser:<br><span style="word-break: break-all;">${link}</span></p>
        <p style="color: #71717a; font-size: 14px;">This link expires in 24 hours.</p>
      </div>
    `;
    return { subject, html, text };
  }
}
