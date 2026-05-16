// Scratch verification for @scheduling/schemas. Pure runtime assertions —
// run via `node packages/schemas/scripts/verify.mjs` after the package builds.
//
// Each case asserts the schema either ACCEPTS (data shape returned) or
// REJECTS (with the expected error path/message). Any failure throws.

import assert from "node:assert/strict";

import {
  // primitives
  RESERVED_SLUGS,
  SLOT_DURATIONS,
  emailSchema,
  hexColorSchema,
  phoneSchema,
  slotDurationSchema,
  slugSchema,
  timeStringSchema,
  timezoneSchema,
  uuidSchema,
  // tenant
  tenantCreateInputSchema,
  tenantSettingsUpdateInputSchema,
  // availability
  availabilityRuleCreateInputSchema,
  availabilityExceptionCreateInputSchema,
  // booking
  ANY_STAFF,
  bookingRequestInputSchema,
  publicAvailabilityQuerySchema,
} from "@scheduling/schemas";

let passed = 0;
let failed = 0;
const failures = [];

function expectOk(label, schema, input, predicate) {
  const r = schema.safeParse(input);
  if (!r.success) {
    failed++;
    failures.push(`${label}: expected success, got ${JSON.stringify(r.error.issues)}`);
    return;
  }
  if (predicate && !predicate(r.data)) {
    failed++;
    failures.push(`${label}: success but predicate failed; data=${JSON.stringify(r.data)}`);
    return;
  }
  passed++;
}

function expectFail(label, schema, input, expectedPath, expectedMessageSubstr) {
  const r = schema.safeParse(input);
  if (r.success) {
    failed++;
    failures.push(`${label}: expected failure, parsed=${JSON.stringify(r.data)}`);
    return;
  }
  const issue = r.error.issues.find((i) => {
    const pathMatches = expectedPath
      ? JSON.stringify(i.path) === JSON.stringify(expectedPath)
      : true;
    const msgMatches = expectedMessageSubstr
      ? i.message.includes(expectedMessageSubstr)
      : true;
    return pathMatches && msgMatches;
  });
  if (!issue) {
    failed++;
    failures.push(
      `${label}: failed but expected issue not present. issues=${JSON.stringify(r.error.issues)}`,
    );
    return;
  }
  passed++;
}

// =============================================================================
// PRIMITIVES
// =============================================================================

// --- slug
expectOk("slug: valid",            slugSchema, "elite-barbers");
expectOk("slug: single char",      slugSchema, "a");
expectFail("slug: uppercase",      slugSchema, "Elite", [], "lowercase");
expectFail("slug: leading dash",   slugSchema, "-bad",  [], "lowercase");
expectFail("slug: trailing dash",  slugSchema, "bad-",  [], "lowercase");
expectFail("slug: contains space", slugSchema, "has space", [], "lowercase");
expectFail("slug: too long",       slugSchema, "a".repeat(64), [], "63 characters");
// reserved
for (const r of RESERVED_SLUGS) {
  expectFail(`slug: reserved (${r})`, slugSchema, r, [], "reserved");
}

// --- email
expectOk("email: lowercased",    emailSchema, "Test@Example.COM", (d) => d === "test@example.com");
expectFail("email: malformed",   emailSchema, "not-an-email");

// --- phone (E.164 normalization)
expectOk("phone: normalize MK",  phoneSchema, "+38970123456",   (d) => d === "+38970123456");
expectOk("phone: normalize US with spaces", phoneSchema, "+1 (415) 555 2671", (d) => d === "+14155552671");
expectFail("phone: bare local", phoneSchema, "070123456");
expectFail("phone: garbage",    phoneSchema, "not-a-phone");

// --- hex color
expectOk("hex: short", hexColorSchema, "#abc");
expectOk("hex: long",  hexColorSchema, "#1f2937");
expectFail("hex: no hash",  hexColorSchema, "1f2937");
expectFail("hex: bad chars", hexColorSchema, "#zzzzzz");

// --- uuid
expectOk("uuid: ok",   uuidSchema, "550e8400-e29b-41d4-a716-446655440000");
expectFail("uuid: bad", uuidSchema, "not-a-uuid");

// --- slot duration
for (const n of SLOT_DURATIONS) expectOk(`slot: ${n}`, slotDurationSchema, n);
expectFail("slot: 7 not allowed", slotDurationSchema, 7);
expectFail("slot: non-int",       slotDurationSchema, 30.5);

// --- time string
expectOk("time: 09:00", timeStringSchema, "09:00");
expectOk("time: 23:59", timeStringSchema, "23:59");
expectFail("time: 24:00", timeStringSchema, "24:00");
expectFail("time: bad",   timeStringSchema, "9:00");

// --- timezone
expectOk("tz: Europe/Skopje", timezoneSchema, "Europe/Skopje");
expectOk("tz: UTC",           timezoneSchema, "UTC");
expectFail("tz: gibberish",   timezoneSchema, "Not/A/Zone");

// =============================================================================
// TENANT
// =============================================================================

expectOk(
  "tenant.create: valid",
  tenantCreateInputSchema,
  {
    name: "Elite Barbers",
    slug: "elite-barbers",
    businessType: "barbershop",
    timezone: "Europe/Skopje",
    contactPhone: "+38970000001",
  },
  (d) => d.contactPhone === "+38970000001",
);
expectFail(
  "tenant.create: reserved slug rejected",
  tenantCreateInputSchema,
  { name: "X", slug: "admin", businessType: "x", timezone: "UTC" },
  ["slug"],
  "reserved",
);
expectFail(
  "tenant.create: bad timezone rejected",
  tenantCreateInputSchema,
  { name: "X", slug: "abc", businessType: "x", timezone: "Mars/Olympus" },
  ["timezone"],
  "IANA",
);

expectOk(
  "tenant.settings.update: cutoffs accepted",
  tenantSettingsUpdateInputSchema,
  {
    defaultSlotDurationMinutes: 30,
    cancellationCutoffMinutes: 120,
    rescheduleCutoffMinutes: 60,
  },
);
expectFail(
  "tenant.settings.update: slot duration 7 rejected",
  tenantSettingsUpdateInputSchema,
  { defaultSlotDurationMinutes: 7 },
);
expectFail(
  "tenant.settings.update: negative cutoff rejected",
  tenantSettingsUpdateInputSchema,
  { cancellationCutoffMinutes: -1 },
);

// =============================================================================
// AVAILABILITY — cross-field
// =============================================================================

expectOk(
  "availability.rule.create: 09:00-17:00 valid",
  availabilityRuleCreateInputSchema,
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
);
expectFail(
  "availability.rule.create: start >= end rejected",
  availabilityRuleCreateInputSchema,
  { dayOfWeek: 1, startTime: "17:00", endTime: "09:00" },
  ["endTime"],
  "before",
);

const TOMORROW = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const YESTERDAY = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

expectOk(
  "availability.exception.create: closed without custom hours",
  availabilityExceptionCreateInputSchema,
  { exceptionDate: TOMORROW, isClosed: true },
);
expectFail(
  "availability.exception.create: closed WITH custom hours rejected",
  availabilityExceptionCreateInputSchema,
  { exceptionDate: TOMORROW, isClosed: true, customStartTime: "09:00", customEndTime: "12:00" },
  ["customStartTime"],
  "Closed",
);
expectOk(
  "availability.exception.create: open with valid custom hours",
  availabilityExceptionCreateInputSchema,
  { exceptionDate: TOMORROW, isClosed: false, customStartTime: "09:00", customEndTime: "12:00" },
);
expectFail(
  "availability.exception.create: only one custom hour rejected",
  availabilityExceptionCreateInputSchema,
  { exceptionDate: TOMORROW, isClosed: false, customStartTime: "09:00" },
  ["customEndTime"],
  "both",
);
expectFail(
  "availability.exception.create: past date rejected",
  availabilityExceptionCreateInputSchema,
  { exceptionDate: YESTERDAY, isClosed: true },
  ["exceptionDate"],
  "past",
);

// =============================================================================
// BOOKING — discriminated union + default staff selector
// =============================================================================

expectOk(
  "publicAvailabilityQuery: defaults staffId to 'any'",
  publicAvailabilityQuerySchema,
  { serviceId: "550e8400-e29b-41d4-a716-446655440000", date: TOMORROW },
  (d) => d.staffId === ANY_STAFF,
);

expectOk(
  "booking.request: authenticated mode",
  bookingRequestInputSchema,
  {
    mode: "authenticated",
    serviceId: "550e8400-e29b-41d4-a716-446655440000",
    startAt: "2026-06-01T10:00:00+02:00",
  },
);
expectOk(
  "booking.request: guest mode with E.164 phone normalization",
  bookingRequestInputSchema,
  {
    mode: "guest",
    serviceId: "550e8400-e29b-41d4-a716-446655440000",
    startAt: "2026-06-01T10:00:00+02:00",
    guest: {
      firstName: "Jane",
      lastName: "Doe",
      phone: "+1 (415) 555 2671",
    },
  },
  (d) => d.mode === "guest" && d.guest.phone === "+14155552671",
);
expectFail(
  "booking.request: missing discriminator rejected",
  bookingRequestInputSchema,
  { serviceId: "550e8400-e29b-41d4-a716-446655440000", startAt: "2026-06-01T10:00:00+02:00" },
);

// =============================================================================
// Report
// =============================================================================

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
assert.equal(failed, 0);
