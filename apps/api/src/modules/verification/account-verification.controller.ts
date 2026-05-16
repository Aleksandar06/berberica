import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  resendVerificationInputSchema,
  verifyEmailInputSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { Public } from "../../common/decorators/public.decorator";
import { AccountVerificationService } from "./account-verification.service";

class VerifyEmailDto extends createZodDto(verifyEmailInputSchema) {}
class ResendVerificationDto extends createZodDto(resendVerificationInputSchema) {}

/**
 * Account-email verification routes. Mounted under `/api/auth/...` so the
 * routes sit next to register/login.
 *
 * Both endpoints emit the SAME response shape regardless of whether the
 * email/token was valid — anti-enumeration.
 */
@Public()
@Controller("auth")
export class AccountVerificationController {
  constructor(
    private readonly verification: AccountVerificationService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: VerifyEmailDto) {
    // Always return ok: we don't tell the caller whether the token matched.
    // A real success will be reflected by the user's next /me call showing
    // emailVerified: true.
    await this.verification.consume(body.token);
    return { ok: true };
  }

  // Aggressive throttle — 3 resends per hour per IP is plenty. The shared
  // rate-limit at the controller decorator level + the issue() idempotency
  // (each new code invalidates prior ones) make spamming useless.
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  async resend(@Body() body: ResendVerificationDto) {
    await this.verification.resend(body.email);
    return { ok: true };
  }
}
