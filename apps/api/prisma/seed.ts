/**
 * Dev seed. Idempotent — wipes tenants + users (cascades to everything
 * tenant-owned) and recreates a known baseline used by Step 5+ tests.
 *
 * Auth landed in Step 4, so this now hashes a known dev password with
 * Argon2id (matching the runtime hasher). Every seeded login uses the
 * password `dev-password-123`. Re-running the seed always re-derives the
 * hash from this constant — never commit a real hash literal here.
 */
import { Algorithm, hash } from "@node-rs/argon2";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_PASSWORD = "dev-password-123";

async function main(): Promise<void> {
  console.log("Seeding…");

  // Hash once, reuse for every seeded user — Argon2 is intentionally slow.
  const passwordHash = await hash(DEV_PASSWORD, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  // --- Reset (cascades wipe everything tenant- or user-owned) -------------
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();

  // --- Tenants ------------------------------------------------------------
  const elite = await prisma.tenant.create({
    data: {
      slug: "elite-barbers",
      name: "Elite Barbers",
      businessType: "barbershop",
      timezone: "Europe/Skopje",
      contactEmail: "hello@elite-barbers.test",
      contactPhone: "+38970000001",
      address: "Centar, Skopje",
      settings: { create: {} },
      branding: {
        create: {
          primaryColor: "#1f2937",
          secondaryColor: "#f59e0b",
          accentColor: "#f43f5e",
        },
      },
    },
  });

  const dental = await prisma.tenant.create({
    data: {
      slug: "smile-dental",
      name: "Smile Dental",
      businessType: "dental_clinic",
      timezone: "Europe/Skopje",
      contactEmail: "hello@smile-dental.test",
      contactPhone: "+38970000002",
      address: "Karpoš, Skopje",
      settings: { create: {} },
      branding: {
        create: {
          primaryColor: "#0ea5e9",
          secondaryColor: "#22c55e",
          accentColor: "#f43f5e",
        },
      },
    },
  });

  // --- Users (real Argon2id hash; password = dev-password-123) -----------
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@example.com",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const eliteAdmin = await prisma.user.create({
    data: {
      email: "admin@elite-barbers.test",
      passwordHash,
      firstName: "Elite",
      lastName: "Owner",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const dentalAdmin = await prisma.user.create({
    data: {
      email: "admin@smile-dental.test",
      passwordHash,
      firstName: "Smile",
      lastName: "Owner",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // --- Roles --------------------------------------------------------------
  for (const t of [elite, dental]) {
    await prisma.tenantUserRole.create({
      data: { userId: superAdmin.id, tenantId: t.id, role: Role.SUPER_ADMIN },
    });
  }
  await prisma.tenantUserRole.create({
    data: { userId: eliteAdmin.id, tenantId: elite.id, role: Role.TENANT_ADMIN },
  });
  await prisma.tenantUserRole.create({
    data: { userId: dentalAdmin.id, tenantId: dental.id, role: Role.TENANT_ADMIN },
  });

  // --- Services -----------------------------------------------------------
  const eliteHaircut = await prisma.service.create({
    data: {
      tenantId: elite.id,
      name: "Classic Haircut",
      description: "30-minute precision cut.",
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
    },
  });
  const eliteShave = await prisma.service.create({
    data: {
      tenantId: elite.id,
      name: "Hot-Towel Shave",
      description: "Traditional straight-razor shave with hot towel.",
      durationMinutes: 45,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
    },
  });
  const dentalCleaning = await prisma.service.create({
    data: {
      tenantId: dental.id,
      name: "Dental Cleaning",
      description: "Routine scaling and polishing.",
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
    },
  });
  const dentalConsult = await prisma.service.create({
    data: {
      tenantId: dental.id,
      name: "Consultation",
      description: "Initial consultation and exam.",
      durationMinutes: 20,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    },
  });

  // --- Staff members ------------------------------------------------------
  const marko = await prisma.staffMember.create({
    data: { tenantId: elite.id, displayName: "Marko Petrov" },
  });
  const ana = await prisma.staffMember.create({
    data: { tenantId: elite.id, displayName: "Ana Stojanova" },
  });
  const drIvanov = await prisma.staffMember.create({
    data: { tenantId: dental.id, displayName: "Dr. Goran Ivanov" },
  });
  const drPetrova = await prisma.staffMember.create({
    data: { tenantId: dental.id, displayName: "Dr. Sara Petrova" },
  });

  // --- Staff ↔ Service ---------------------------------------------------
  const staffServiceLinks = [
    { staff: marko,     service: eliteHaircut,   tenantId: elite.id },
    { staff: marko,     service: eliteShave,     tenantId: elite.id },
    { staff: ana,       service: eliteHaircut,   tenantId: elite.id },
    { staff: drIvanov,  service: dentalCleaning, tenantId: dental.id },
    { staff: drIvanov,  service: dentalConsult,  tenantId: dental.id },
    { staff: drPetrova, service: dentalCleaning, tenantId: dental.id },
  ] as const;

  for (const link of staffServiceLinks) {
    await prisma.staffService.create({
      data: {
        tenantId: link.tenantId,
        staffMemberId: link.staff.id,
        serviceId: link.service.id,
      },
    });
  }

  // --- Availability: Mon–Fri 09:00–17:00 for each staff ------------------
  const weekdays = [1, 2, 3, 4, 5];
  const allStaff = [
    { staff: marko,     tenantId: elite.id },
    { staff: ana,       tenantId: elite.id },
    { staff: drIvanov,  tenantId: dental.id },
    { staff: drPetrova, tenantId: dental.id },
  ];
  const nineAM = new Date("1970-01-01T09:00:00Z");
  const fivePM = new Date("1970-01-01T17:00:00Z");

  for (const { staff, tenantId } of allStaff) {
    for (const dow of weekdays) {
      await prisma.availabilityRule.create({
        data: {
          tenantId,
          staffMemberId: staff.id,
          dayOfWeek: dow,
          startTime: nineAM,
          endTime: fivePM,
          slotDurationMinutes: null,
        },
      });
    }
  }

  // --- One confirmed booking per tenant so cross-tenant tests have data --
  const eliteCustomer = await prisma.customer.create({
    data: {
      tenantId: elite.id,
      firstName: "Liam",
      lastName: "K.",
      phone: "+38970555111",
    },
  });
  const dentalCustomer = await prisma.customer.create({
    data: {
      tenantId: dental.id,
      firstName: "Ema",
      lastName: "P.",
      phone: "+38970555222",
    },
  });

  await prisma.booking.create({
    data: {
      tenantId: elite.id,
      staffMemberId: marko.id,
      serviceId: eliteHaircut.id,
      customerId: eliteCustomer.id,
      startAt: new Date("2026-06-01T10:00:00Z"),
      endAt: new Date("2026-06-01T10:35:00Z"),
      status: "confirmed",
    },
  });
  await prisma.booking.create({
    data: {
      tenantId: dental.id,
      staffMemberId: drIvanov.id,
      serviceId: dentalCleaning.id,
      customerId: dentalCustomer.id,
      startAt: new Date("2026-06-01T10:00:00Z"),
      endAt: new Date("2026-06-01T11:00:00Z"),
      status: "confirmed",
    },
  });

  console.log("Seed complete:");
  console.log({
    tenants: 2,
    users: 3,
    services: 4,
    staffMembers: 4,
    customers: 2,
    bookings: 2,
    availabilityRules: weekdays.length * allStaff.length,
    devPassword: DEV_PASSWORD,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
