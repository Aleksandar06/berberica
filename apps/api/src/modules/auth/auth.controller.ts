import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { CookieConfig } from "../../common/config/configuration";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "../../common/types/request-user.types";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dtos";

/**
 * Auth endpoints.
 *
 * Cookie strategy for the refresh token:
 *   • HttpOnly       → not readable by JS, prevents XSS exfiltration.
 *   • Secure         → only sent over HTTPS in production.
 *   • SameSite=Strict→ browser refuses to send on cross-site contexts; this
 *                      is the primary CSRF defense.
 *   • Path=/api/auth → cookie is only sent to auth endpoints, narrowing the
 *                      attack surface.
 *
 * Additional CSRF layer on /refresh: requires an `x-requested-with` header,
 * which browsers do NOT permit on cross-site simple-form submits. Belt +
 * suspenders for the SameSite=Strict guarantee.
 */
@Controller("auth")
export class AuthController {
  private readonly cookieCfg: CookieConfig;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    const cookieCfg = config.get<CookieConfig>("cookie");
    const ttl = config.get<number>("jwt.refreshTtlSeconds");
    if (!cookieCfg || !ttl) throw new Error("Cookie / refresh config missing");
    this.cookieCfg = cookieCfg;
    this.refreshTtlSeconds = ttl;
  }

  // -------------------------------------------------------------------------
  // POST /api/auth/register
  // -------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60 * 1000 } }) // 5 / 10min / IP
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.register(body);
    this.setRefreshCookie(reply, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  // -------------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------------
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } }) // 5 / min / IP
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.auth.login(body);
    this.setRefreshCookie(reply, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  // -------------------------------------------------------------------------
  // POST /api/auth/refresh
  // -------------------------------------------------------------------------
  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Layer-2 CSRF defense (in addition to SameSite=Strict). Browsers
    // do not allow setting custom headers on cross-site simple form posts.
    const xrw = req.headers["x-requested-with"];
    if (xrw !== "XMLHttpRequest") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const raw = readRefreshCookie(req);
    if (!raw) throw new UnauthorizedException("Invalid credentials");

    const session = await this.auth.refresh(raw);
    this.setRefreshCookie(reply, session.refreshToken);
    return {
      user: session.user,
      accessToken: session.accessToken,
    };
  }

  // -------------------------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------------------------
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const raw = readRefreshCookie(req);
    await this.auth.logout(raw);
    this.clearRefreshCookie(reply);
  }

  // -------------------------------------------------------------------------
  // GET /api/auth/me  (protected; JwtAuthGuard provides @CurrentUser())
  // -------------------------------------------------------------------------
  @Get("me")
  async me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.userId);
  }

  // -------------------------------------------------------------------------

  private setRefreshCookie(reply: FastifyReply, raw: string): void {
    reply.setCookie(REFRESH_COOKIE_NAME, raw, {
      httpOnly: true,
      secure: this.cookieCfg.secure,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshTtlSeconds,
    });
  }

  private clearRefreshCookie(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.cookieCfg.secure,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
    });
  }
}

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

function readRefreshCookie(req: FastifyRequest): string | undefined {
  // @fastify/cookie attaches parsed cookies to req.cookies.
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return cookies?.[REFRESH_COOKIE_NAME];
}
