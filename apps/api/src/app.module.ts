import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import Redis from "ioredis";
import { ZodValidationPipe } from "nestjs-zod";

import { CommonModule } from "./common/common.module";
import configuration, {
  type RedisConfig,
} from "./common/config/configuration";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { HealthController } from "./health/health.controller";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { BusinessModule } from "./modules/business/business.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PublicModule } from "./modules/public/public.module";
import { ServicesModule } from "./modules/services/services.module";
import { StaffModule } from "./modules/staff/staff.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Throttler with Redis storage so limits hold across instances.
    // Per-route overrides via @Throttle({ default: { limit, ttl } }) on
    // sensitive endpoints (see AuthController).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get<RedisConfig>("redis");
        if (!redis) throw new Error("Redis config missing");
        return {
          throttlers: [{ name: "default", ttl: 60 * 1000, limit: 100 }],
          storage: new ThrottlerStorageRedisService(new Redis(redis.url)),
        };
      },
    }),

    PrismaModule,
    CommonModule,
    NotificationsModule,
    VerificationModule,
    AuthModule,
    AdminModule,
    BusinessModule,
    ServicesModule,
    StaffModule,
    AvailabilityModule,
    BookingsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global validation via nestjs-zod — DTOs created with createZodDto
    // attach their Zod schema as metadata; this pipe reads it on every
    // controller param annotated with the DTO.
    { provide: APP_PIPE, useClass: ZodValidationPipe },

    // Global error normalization (must come BEFORE guards listed below so it
    // catches their thrown exceptions consistently).
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Guard order matters: Throttler runs first (cheap, blocks early), then
    // Jwt (verifies caller), then Roles (checks @Roles metadata).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
