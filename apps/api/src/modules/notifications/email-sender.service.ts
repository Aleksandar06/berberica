import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import type { EmailConfig } from "../../common/config/configuration";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Thin wrapper over the Resend HTTP API.
 *
 * If RESEND_API_KEY is unset we log the email to stdout instead of sending —
 * this keeps first-run dev unblocked even before a key is provisioned. The
 * `.env.example` calls this out so an operator can't accidentally ship to
 * production thinking emails are flowing.
 */
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const email = config.get<EmailConfig>("email");
    if (!email) throw new Error("Email config missing");
    this.from = email.from;
    this.client = email.apiKey ? new Resend(email.apiKey) : null;
    if (!this.client) {
      this.logger.warn(
        "RESEND_API_KEY is not set — verification emails will be logged to the console instead of sent.",
      );
    }
  }

  async send(args: SendEmailArgs): Promise<void> {
    if (!this.client) {
      this.logger.log(
        `[email:dev-log] to=${args.to} subject=${args.subject}\n${args.text}`,
      );
      return;
    }
    const { error } = await this.client.emails.send({
      from: this.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    if (error) {
      throw new Error(
        `Resend send failed: ${error.name ?? "unknown"} — ${error.message ?? ""}`,
      );
    }
  }
}
