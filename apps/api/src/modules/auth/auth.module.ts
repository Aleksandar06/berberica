import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { VerificationModule } from "../verification/verification.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { TokenService } from "./token.service";

/**
 * Auth module. PrismaModule is already @Global, so we don't import it here.
 * Secrets are supplied per-call inside TokenService (not via JwtModule.register
 * options), so we just register an empty JwtModule to get the JwtService
 * provider into the DI container.
 *
 * Step 11A: imports VerificationModule so AuthService can issue an account-
 * email verification token on register.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), VerificationModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
