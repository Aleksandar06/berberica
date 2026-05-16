import {
  loginInputSchema,
  registerInputSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

/**
 * Thin DTO classes that bridge the shared Zod schemas to NestJS request
 * binding. The schemas themselves remain in `packages/schemas` — these
 * just attach Nest's metadata so `@Body() body: RegisterDto` validates
 * via the global ZodValidationPipe.
 */
export class RegisterDto extends createZodDto(registerInputSchema) {}

export class LoginDto extends createZodDto(loginInputSchema) {}
