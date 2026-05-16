import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Wraps Passport's JWT strategy so we can short-circuit on @Public routes
 * AND normalize the rejection error (vanilla Passport throws a noisy
 * 401 — we replace it with a generic UNAUTHORIZED to match login failures
 * and avoid leaking the precise reason).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  // Passport calls this with the result of the strategy. If validation
  // failed (no token, expired, wrong signature, user not found), we throw
  // a uniform UnauthorizedException.
  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException("Authentication required");
    }
    return user as TUser;
  }
}
