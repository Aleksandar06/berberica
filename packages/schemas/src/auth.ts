import { z } from "zod";

import { emailSchema } from "./primitives";

// 12-char minimum aligns with the OWASP ASVS L1 baseline and modern guidance;
// the actual hashing (Argon2id) happens server-side in Step 4.
export const registerInputSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(256, "Password too long"),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(256),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// Refresh-token rotation (Step 4). The token itself rides in an HttpOnly cookie,
// so the request body is empty — but the schema is here for shape clarity.
export const refreshInputSchema = z.object({}).strict();
export type RefreshInput = z.infer<typeof refreshInputSchema>;
