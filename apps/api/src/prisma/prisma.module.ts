import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

// @Global makes PrismaService injectable from any module without re-importing
// PrismaModule. The downside (tight coupling) is acceptable here because every
// feature module needs database access and there is exactly one Prisma client.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
