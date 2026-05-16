import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { JwtConfig } from "../../common/config/configuration";
import type { RequestUser } from "../../common/types/request-user.types";
import { PrismaService } from "../../prisma/prisma.service";
import type { AccessTokenPayload } from "./token.service";

/**
 * Passport JWT strategy. Validates the bearer access token, then loads the
 * user + memberships on every request so role state is current (token has a
 * 15-minute lifetime, but role changes propagate immediately to the next
 * request rather than waiting for token expiry).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwt = config.get<JwtConfig>("jwt");
    if (!jwt) throw new Error("JWT config missing");
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenantRoles: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return {
      userId: user.id,
      email: user.email,
      memberships: user.tenantRoles.map((tr) => ({
        tenantId: tr.tenantId,
        role: tr.role,
      })),
    };
  }
}
