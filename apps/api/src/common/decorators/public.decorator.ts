import { SetMetadata } from "@nestjs/common";

/**
 * Marks a route handler (or controller) as publicly accessible. JwtAuthGuard
 * checks for this metadata key and short-circuits when present.
 */
export const IS_PUBLIC_KEY = "isPublic";

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
