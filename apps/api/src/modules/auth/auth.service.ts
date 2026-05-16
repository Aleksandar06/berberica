import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { LoginInput, RegisterInput } from "@scheduling/schemas";

import { PrismaService } from "../../prisma/prisma.service";
import { AccountVerificationService } from "../verification/account-verification.service";
import { hashPassword, verifyPassword } from "./argon2.helper";
import { TokenService } from "./token.service";

export interface AuthSessionResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
}

/** Generic credential failure — same shape for every reason a login can fail
 *  so attackers cannot distinguish "user not found" from "wrong password". */
const INVALID_CREDENTIALS = "Invalid credentials";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly accountVerification: AccountVerificationService,
  ) {}

  // -------------------------------------------------------------------------
  // REGISTER
  // -------------------------------------------------------------------------

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    // Normalize email — Zod already lowercased+trimmed but we re-key on the
    // canonical value to be safe.
    const email = input.email.toLowerCase().trim();

    // Surface a 409 only when the email already exists. We accept that this
    // is a minor user-enumeration vector on the register endpoint (this is
    // standard — users need feedback that the email is taken). Login keeps
    // a uniform 401 to block enumeration where it matters most.
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        // Flips true after the user completes Step 11A's verify-email flow.
        emailVerified: false,
      },
    });

    // Step 11A — issue the verification token + enqueue the email
    // notification. Failures here MUST NOT break registration; we log and
    // continue so the user can self-serve a resend.
    try {
      await this.accountVerification.issue(email);
    } catch (err) {
      this.logger.error(
        `Failed to issue verification token for ${email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return this.buildSession(user);
  }

  // -------------------------------------------------------------------------
  // LOGIN
  // -------------------------------------------------------------------------

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const email = input.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Dummy verify against a constant hash so timing matches the "wrong
      // password" branch — without this, response time leaks user existence.
      await verifyPassword(TIMING_SAFE_DUMMY_HASH, input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.buildSession(user);
  }

  // -------------------------------------------------------------------------
  // REFRESH
  // -------------------------------------------------------------------------

  async refresh(rawRefreshToken: string): Promise<AuthSessionResult> {
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken);
    if (!rotated) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return {
      user: toPublicUser(user),
      accessToken: this.tokens.signAccessToken({ sub: user.id, email: user.email }),
      refreshToken: rotated.raw,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  // -------------------------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------------------------

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return; // idempotent — no cookie, nothing to do
    await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  // -------------------------------------------------------------------------
  // ME — returns the user plus all tenant memberships (no secrets).
  // -------------------------------------------------------------------------

  async me(userId: string): Promise<{
    user: PublicUser;
    memberships: Array<{
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      role: string;
    }>;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantRoles: { include: { tenant: true } },
      },
    });
    if (!user || !user.isActive) {
      // The JWT guard already validated the user exists — but state may have
      // changed between then and now (suspended in a parallel admin action).
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return {
      user: toPublicUser(user),
      memberships: user.tenantRoles.map((tr) => ({
        tenantId: tr.tenantId,
        tenantSlug: tr.tenant.slug,
        tenantName: tr.tenant.name,
        role: tr.role,
      })),
    };
  }

  // -------------------------------------------------------------------------

  private async buildSession(user: User): Promise<AuthSessionResult> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
    });
    const { raw: refreshToken, expiresAt: refreshExpiresAt } =
      await this.tokens.issueRefreshToken(user.id);
    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }
}

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    emailVerified: u.emailVerified,
  };
}

/**
 * A pre-computed Argon2id hash used only to equalize timing between the
 * "user not found" and "wrong password" branches of login. The plaintext
 * intentionally cannot match any real password because it includes a marker
 * not legal in our register schema. Generated once at module load.
 */
const TIMING_SAFE_DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$dGltaW5nLXNhZmUtZHVtbXk$b1+P3sm5wU9R2u6mtTXAm6m7s9Z9zXJgQfm14sX1Vd0";
