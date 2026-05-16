import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { FastifyRequest } from "fastify";

/**
 * "Try-to-auth-but-don't-fail" guard.
 *
 *   • No `Authorization` header at all → pass through, `req.user` stays
 *     undefined. (The route is welcoming to anonymous callers.)
 *   • Bearer present and VALID → `req.user` gets the strategy's payload, as
 *     with the normal JwtAuthGuard.
 *   • Bearer present and INVALID/expired → reject with 401. We deliberately
 *     don't downgrade bad tokens to anonymous — a caller with a broken
 *     token has a bug they should see, not silently get treated as a guest.
 *
 * Used by the public booking endpoint so a registered customer can book
 * with their bearer (authenticated mode) and an anonymous visitor can book
 * with guest details (guest mode), both hitting the same URL.
 */
@Injectable()
export class MaybeJwtAuthGuard extends AuthGuard("jwt") {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = req.headers.authorization;
    if (typeof auth !== "string" || !auth.toLowerCase().startsWith("bearer ")) {
      return true;
    }
    // Bearer present — defer to the standard JwtAuthGuard.
    return Boolean(await super.canActivate(context));
  }

  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err) throw new UnauthorizedException();
    if (!user) {
      // Bearer was present but produced no user — bad token.
      throw new UnauthorizedException();
    }
    return user as TUser;
  }
}
