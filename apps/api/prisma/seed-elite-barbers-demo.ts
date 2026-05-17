/**
 * Demo-data seeder for the Elite Barbers tenant on production.
 *
 * Idempotent — safe to run multiple times. Only touches Elite Barbers.
 * Run with the production DATABASE_URL exported in the environment:
 *
 *   pnpm --filter @scheduling/api exec tsx prisma/seed-elite-barbers-demo.ts
 *
 * What it does:
 *   1. Sets prices on the existing 2 services + adds 6 more.
 *   2. Adds 2 more staff (so we have 4 total).
 *   3. Wires staff-service assignments.
 *   4. Creates 12 customers with realistic Macedonian names.
 *   5. Spawns ~45 bookings spanning [today-14, today+21] with a status mix
 *      that drives the Today / Bookings / Earnings dashboards.
 *
 * Non-overlap discipline: future bookings (status pending/confirmed) must
 * respect the partial EXCLUDE constraint on bookings.startAt-endAt range.
 * The placer assigns staff time slots sequentially per day to avoid
 * collisions. Past bookings (completed/cancelled/no_show) are not subject
 * to the exclusion so they can land anywhere.
 */
import { PrismaClient, type BookingStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_SLUG = "elite-barbers";

// All times in UTC for storage; the venue is in Europe/Skopje (UTC+2 in
// summer). Slot times below are wall-clock at the venue, converted to UTC
// in `wallClockToUtc()` below.
const VENUE_OFFSET_HOURS = 2;

// Service catalogue (prices in cents).
const SERVICES = [
  // Existing — match by name and update.
  { name: "Classic Haircut", duration: 30, price: 1200, descr: "30-minute precision cut.", bufferAfter: 5 },
  { name: "Hot-Towel Shave", duration: 45, price: 1800, descr: "Traditional straight-razor shave with hot towel.", bufferBefore: 5, bufferAfter: 5 },
  // New.
  { name: "Beard Trim", duration: 20, price: 800, descr: "Shape-up + line work, hot oil finish." },
  { name: "Skin Fade", duration: 45, price: 1500, descr: "High / mid / low — clipper precision down to 0." },
  { name: "Hair & Beard Combo", duration: 60, price: 2200, descr: "Full haircut + beard sculpt + hot-towel finish." },
  { name: "Father & Son", duration: 60, price: 2500, descr: "Two cuts side-by-side. Hot cocoa included for the kid." },
  { name: "Buzz Cut", duration: 15, price: 600, descr: "Single guard, 5 minutes in the chair, walk out fresh." },
  { name: "Kids Cut (under 12)", duration: 25, price: 800, descr: "Patient barbers, lollipops, no judgement on Roblox haircuts." },
] as const;

const STAFF = [
  // Existing — match by displayName and skip.
  { displayName: "Ana Stojanova" },
  { displayName: "Marko Petrov" },
  // New.
  { displayName: "Damjan Petrovski" },
  { displayName: "Stefan Mitev" },
];

const CUSTOMERS = [
  { firstName: "Bojan",      lastName: "Stojanovski",   phone: "+38971111001" },
  { firstName: "Nikola",     lastName: "Trajkov",       phone: "+38971111002" },
  { firstName: "Ilija",      lastName: "Mitev",         phone: "+38971111003" },
  { firstName: "Ana",        lastName: "Popovska",      phone: "+38971111004", email: "ana.popovska@example.com" },
  { firstName: "Tamara",     lastName: "Dimitrova",     phone: "+38971111005", email: "tamara.d@example.com" },
  { firstName: "Maja",       lastName: "Stefanova",     phone: "+38971111006" },
  { firstName: "Mitko",      lastName: "Kolev",         phone: "+38971111007" },
  { firstName: "Dragan",     lastName: "Iliev",         phone: "+38971111008" },
  { firstName: "Stefan",     lastName: "Velkovski",     phone: "+38971111009" },
  { firstName: "Aleksandar", lastName: "Jovanovski",    phone: "+38971111010", email: "aleksandar.j@example.com" },
  { firstName: "Damjan",     lastName: "Bogoev",        phone: "+38971111011" },
  { firstName: "Viktor",     lastName: "Gjorgjievski",  phone: "+38971111012" },
];

// ===========================================================================

async function main() {
  console.log("→ Locating tenant…");
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    throw new Error(`Tenant "${TENANT_SLUG}" not found.`);
  }

  // ---------------- SERVICES ----------------
  console.log("→ Upserting services…");
  const serviceRows: Array<{ id: string; durationMinutes: number; bufferBefore: number; bufferAfter: number }> = [];
  for (const s of SERVICES) {
    const existing = await prisma.service.findFirst({
      where: { tenantId: tenant.id, name: s.name },
    });
    if (existing) {
      const updated = await prisma.service.update({
        where: { id: existing.id },
        data: {
          priceCents: s.price,
          description: s.descr,
          durationMinutes: s.duration,
          bufferBeforeMinutes: s.bufferBefore ?? existing.bufferBeforeMinutes,
          bufferAfterMinutes: s.bufferAfter ?? existing.bufferAfterMinutes,
          isActive: true,
        },
      });
      serviceRows.push({
        id: updated.id,
        durationMinutes: updated.durationMinutes,
        bufferBefore: updated.bufferBeforeMinutes,
        bufferAfter: updated.bufferAfterMinutes,
      });
      console.log(`   updated "${s.name}" → €${(s.price / 100).toFixed(2)}`);
    } else {
      const created = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          description: s.descr,
          durationMinutes: s.duration,
          bufferBeforeMinutes: s.bufferBefore ?? 0,
          bufferAfterMinutes: s.bufferAfter ?? 0,
          priceCents: s.price,
          isActive: true,
        },
      });
      serviceRows.push({
        id: created.id,
        durationMinutes: created.durationMinutes,
        bufferBefore: created.bufferBeforeMinutes,
        bufferAfter: created.bufferAfterMinutes,
      });
      console.log(`   created "${s.name}" → €${(s.price / 100).toFixed(2)}`);
    }
  }

  // ---------------- STAFF ----------------
  console.log("→ Upserting staff…");
  const staffRows: Array<{ id: string; displayName: string }> = [];
  for (const st of STAFF) {
    const existing = await prisma.staffMember.findFirst({
      where: { tenantId: tenant.id, displayName: st.displayName },
    });
    if (existing) {
      staffRows.push({ id: existing.id, displayName: existing.displayName });
      console.log(`   exists "${st.displayName}"`);
    } else {
      const created = await prisma.staffMember.create({
        data: { tenantId: tenant.id, displayName: st.displayName, isActive: true },
      });
      staffRows.push({ id: created.id, displayName: created.displayName });
      console.log(`   created "${st.displayName}"`);
    }
  }

  // ---------------- STAFF ↔ SERVICES ----------------
  console.log("→ Wiring staff-service assignments…");
  // Every staff member can perform Classic Haircut + Beard Trim (universal).
  // Specialty services distributed so no one has all services.
  const everyone = staffRows.map((s) => s.id);
  const specialists = (count: number) =>
    [...everyone].sort(() => Math.random() - 0.5).slice(0, count);

  const assignments: Record<string, string[]> = {
    "Classic Haircut": everyone,
    "Buzz Cut": everyone,
    "Beard Trim": everyone,
    "Hot-Towel Shave": specialists(3),
    "Skin Fade": specialists(3),
    "Hair & Beard Combo": specialists(3),
    "Father & Son": specialists(2),
    "Kids Cut (under 12)": specialists(2),
  };

  for (const [svcName, staffIds] of Object.entries(assignments)) {
    const svc = SERVICES.find((s) => s.name === svcName);
    if (!svc) continue;
    const svcRow = serviceRows[SERVICES.indexOf(svc)];
    if (!svcRow) continue;
    for (const staffId of staffIds) {
      await prisma.staffService.upsert({
        where: {
          staffMemberId_serviceId: { staffMemberId: staffId, serviceId: svcRow.id },
        },
        update: {},
        create: { tenantId: tenant.id, staffMemberId: staffId, serviceId: svcRow.id },
      });
    }
  }

  // ---------------- CUSTOMERS ----------------
  console.log("→ Upserting customers…");
  const customerRows: Array<{ id: string; firstName: string; lastName: string }> = [];
  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, phone: c.phone },
    });
    if (existing) {
      customerRows.push({ id: existing.id, firstName: existing.firstName, lastName: existing.lastName });
    } else {
      const created = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email ?? null,
        },
      });
      customerRows.push({ id: created.id, firstName: c.firstName, lastName: c.lastName });
    }
  }
  console.log(`   ${customerRows.length} customers ready`);

  // ---------------- BOOKINGS ----------------
  console.log("→ Spawning bookings…");

  // Skip if Elite Barbers already has 30+ bookings — assume we've seeded.
  const existingCount = await prisma.booking.count({ where: { tenantId: tenant.id } });
  if (existingCount >= 30) {
    console.log(`   skip — already have ${existingCount} bookings (idempotent)`);
  } else {
    const plan = generateBookingPlan(serviceRows, staffRows, customerRows);
    let inserted = 0;
    for (const b of plan) {
      try {
        await prisma.booking.create({
          data: {
            tenantId: tenant.id,
            staffMemberId: b.staffId,
            serviceId: b.serviceId,
            customerId: b.customerId,
            startAt: b.startAt,
            endAt: b.endAt,
            status: b.status,
          },
        });
        inserted++;
      } catch (err) {
        // Likely an exclusion-constraint hit on a future pending/confirmed
        // overlap. Skip the row rather than abort the seed.
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`   skipped one (${b.status} @ ${b.startAt.toISOString()}): ${msg.slice(0, 80)}`);
      }
    }
    console.log(`   ${inserted}/${plan.length} bookings inserted`);
  }

  console.log("✓ done");
}

// ===========================================================================
// HELPERS
// ===========================================================================

interface SeededService {
  id: string;
  durationMinutes: number;
  bufferBefore: number;
  bufferAfter: number;
}
interface SeededStaff {
  id: string;
  displayName: string;
}
interface SeededCustomer {
  id: string;
  firstName: string;
  lastName: string;
}
interface PlannedBooking {
  staffId: string;
  serviceId: string;
  customerId: string;
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
}

/**
 * Builds a deterministic-ish booking plan across [today-14, today+21]:
 *
 *   PAST  (-14 .. -1):  ~3 bookings/day, statuses weighted to
 *                       completed (70%) / cancelled (20%) / no_show (10%).
 *   TODAY (0):          5 bookings — 1 completed, 2 confirmed,
 *                       1 pending, 1 walk-out-no_show.
 *   FUTURE (+1 .. +21): ~2 bookings/day, statuses 60% confirmed,
 *                       40% pending. Strict non-overlap per staff.
 */
function generateBookingPlan(
  services: SeededService[],
  staff: SeededStaff[],
  customers: SeededCustomer[],
): PlannedBooking[] {
  const out: PlannedBooking[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Track future slots per staff to avoid overlaps. Past slots aren't
  // subject to the exclusion constraint so we skip the tracking there.
  const futureSlotsByStaff = new Map<string, Array<[number, number]>>();

  const pickCustomer = (idx: number) => customers[idx % customers.length]!;
  // Skip Sunday (Europe/Skopje closed day).
  const isClosed = (day: Date) => day.getUTCDay() === 0;

  // Wall-clock hours of the venue per day — 09:00-19:00. We schedule slots
  // every 30 min for variety.
  const dayHours = [9, 10, 11, 12, 14, 15, 16, 17, 18];

  const placeBooking = (
    day: Date,
    hour: number,
    minute: number,
    serviceIdx: number,
    staffIdx: number,
    customerIdx: number,
    status: BookingStatus,
    isFuture: boolean,
  ): boolean => {
    const svc = services[serviceIdx % services.length]!;
    const st = staff[staffIdx % staff.length]!;
    const cust = pickCustomer(customerIdx);

    const start = wallClockToUtc(day, hour, minute);
    const end = new Date(
      start.getTime() + (svc.durationMinutes + svc.bufferAfter + svc.bufferBefore) * 60_000,
    );

    if (isFuture) {
      const slots = futureSlotsByStaff.get(st.id) ?? [];
      const startMs = start.getTime();
      const endMs = end.getTime();
      if (slots.some(([s, e]) => !(endMs <= s || startMs >= e))) {
        return false;
      }
      slots.push([startMs, endMs]);
      futureSlotsByStaff.set(st.id, slots);
    }

    out.push({
      staffId: st.id,
      serviceId: svc.id,
      customerId: cust.id,
      startAt: start,
      endAt: end,
      status,
    });
    return true;
  };

  // --- PAST 14 days ----------------------------------------------------
  for (let d = -14; d <= -1; d++) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() + d);
    if (isClosed(day)) continue;
    // 3 bookings per past day.
    for (let i = 0; i < 3; i++) {
      const status: BookingStatus =
        Math.random() < 0.7
          ? "completed"
          : Math.random() < 0.66
            ? "cancelled"
            : "no_show";
      placeBooking(
        day,
        dayHours[i * 2 % dayHours.length]!,
        i % 2 === 0 ? 0 : 30,
        (Math.abs(d) + i) % services.length,
        (Math.abs(d) + i) % staff.length,
        Math.abs(d) * 3 + i,
        status,
        false,
      );
    }
  }

  // --- TODAY -----------------------------------------------------------
  if (!isClosed(today)) {
    // 1 completed (earlier morning)
    placeBooking(today, 9, 0, 0, 0, 0, "completed", false);
    // 2 confirmed (mid-day, future-ish)
    placeBooking(today, 11, 0, 1, 1, 1, "confirmed", true);
    placeBooking(today, 14, 30, 2, 2, 2, "confirmed", true);
    // 1 pending (later)
    placeBooking(today, 16, 0, 3, 3, 3, "pending", true);
    // 1 no_show earlier today
    placeBooking(today, 10, 0, 4, 0, 4, "no_show", false);
  }

  // --- FUTURE 21 days --------------------------------------------------
  for (let d = 1; d <= 21; d++) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() + d);
    if (isClosed(day)) continue;
    // 2-3 bookings per day.
    const count = (d % 3) + 2;
    for (let i = 0; i < count; i++) {
      const status: BookingStatus =
        Math.random() < 0.6 ? "confirmed" : "pending";
      placeBooking(
        day,
        dayHours[(d + i) % dayHours.length]!,
        i % 2 === 0 ? 0 : 30,
        (d + i) % services.length,
        (d + i * 2) % staff.length,
        (d * 4 + i) % customers.length,
        status,
        true,
      );
    }
  }

  return out;
}

/** Build a UTC Date that represents `hour:minute` wall-clock in the venue's
 *  timezone (UTC+2 fixed offset — close enough for Skopje in May; the venue
 *  itself stores all times in UTC). */
function wallClockToUtc(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setUTCHours(hour - VENUE_OFFSET_HOURS, minute, 0, 0);
  return d;
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
