import { z } from "zod";

import { isoDateSchema } from "./primitives";

/**
 * Query for the business earnings analytics endpoint. Both bounds are
 * inclusive at the day-level (server expands to [from 00:00 UTC, to+1 00:00 UTC)).
 *
 * Defaults to "today" so a no-arg fetch returns same-day numbers; the web
 * dashboard always passes explicit bounds.
 */
export const businessEarningsQuerySchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine(
    (q) => !q.from || !q.to || q.from <= q.to,
    { message: "`from` must be on or before `to`", path: ["from"] },
  );
export type BusinessEarningsQuery = z.infer<typeof businessEarningsQuerySchema>;
