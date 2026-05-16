import { randomBytes, createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import type { RefreshToken } from "@prisma/client";

import type { JwtConfig } from "../../common/config/configuration";
import { PrismaService } from "../../prisma/prisma.service";

/** Payload carried in the access token. Memberships are looked up fresh per
 *  request in JwtStrategy.validate(), so they stay current within the access
 *  token's 15-minute lifetime — no JWT re-issue needed when roles change.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  /** Raw refresh token — the value placed in the HttpOnly cookie. The DB
   *  only ever stores its SHA-256 hash. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const cfg = config.get<JwtConfig>("jwt");
    if (!cfg) throw new Error("JWT config missing");
    this.jwtConfig = cfg;
  }

  // -------------------------------------------------------------------------
  // ACCESS TOKEN
  // -------------------------------------------------------------------------

  signAccessToken(payload: AccessTokenPayload): string {
    // expiresIn's type from jsonwebtoken/ms is a tagged template literal in
    // strict mode (e.g. "15m"). Our config validates the shape upstream, so
    // a runtime-safe cast at this boundary is fine.
    return this.jwt.sign(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessTtl as JwtSignOptions["expiresIn"],
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.jwtConfig.accessSecret,
    });
  }

  // -------------------------------------------------------------------------
  // REFRESH TOKEN (opaque random; SHA-256 hashed at rest)
  // -------------------------------------------------------------------------

  /**
   * Issues a new refresh token row in the DB and returns the raw value to
   * place in the cookie. Hashes the raw value with SHA-256 before persisting
   * so a database leak does not give an attacker usable session tokens.
   */
  async issueRefreshToken(userId: string): Promise<{
    raw: string;
    expiresAt: Date;
  }> {
    const raw = randomBytes(48).toString("base64url"); // 384 bits of entropy
    const tokenHash = this.hashRefresh(raw);
    const expiresAt = new Date(
      Date.now() + this.jwtConfig.refreshTtlSeconds * 1000,
    );
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { raw, expiresAt };
  }

  /**
   * Rotates a refresh token. Behavior:
   *   • Token unknown → null (caller emits generic 401)
   *   • Token revoked → REUSE detected; revoke every active refresh token
   *     for the user (assume the chain is compromised) and return null.
   *   • Token expired → revoke this row and return null.
   *   • Otherwise → revoke this row and issue a fresh one. Returns the new
   *     raw token + its expiry.
   */
  async rotateRefreshToken(rawToken: string): Promise<{
    raw: string;
    expiresAt: Date;
    userId: string;
  } | null> {
    const tokenHash = this.hashRefresh(rawToken);
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });
    if (!existing) return null;

    if (existing.revokedAt !== null) {
      // Reuse of an already-revoked token: the attacker most likely captured
      // the cookie. Nuke every active token for this user.
      this.logger.warn(
        `Refresh-token reuse detected for user ${existing.userId}; revoking all active tokens`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      await this.revokeRow(existing);
      return null;
    }

    // Rotate: revoke the consumed row + issue a fresh one in a transaction so
    // we never have both active simultaneously.
    const issued = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      const newRaw = randomBytes(48).toString("base64url");
      const newHash = this.hashRefresh(newRaw);
      const expiresAt = new Date(
        Date.now() + this.jwtConfig.refreshTtlSeconds * 1000,
      );
      await tx.refreshToken.create({
        data: { userId: existing.userId, tokenHash: newHash, expiresAt },
      });
      return { raw: newRaw, expiresAt };
    });

    return { raw: issued.raw, expiresAt: issued.expiresAt, userId: existing.userId };
  }

  /** Revokes a refresh token if it exists. Idempotent on already-revoked rows. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashRefresh(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------

  private hashRefresh(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  private async revokeRow(row: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
  }
}
