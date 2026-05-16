/**
 * @scheduling/schemas — shared Zod validation schemas.
 *
 * Single source of truth for request/DTO shapes used by both the NestJS API
 * (via nestjs-zod) and the Next.js web app (via @hookform/resolvers/zod).
 * Pure validation: no Prisma, no env, no I/O. Browser-safe.
 *
 * Import everything from the package root:
 *
 *   import { slugSchema, bookingRequestInputSchema } from "@scheduling/schemas";
 *
 * Inferred types are exported alongside each schema.
 */
export * from "./primitives";
export * from "./auth";
export * from "./tenant";
export * from "./service";
export * from "./staff";
export * from "./availability";
export * from "./booking";
export * from "./admin";
export * from "./verification";
