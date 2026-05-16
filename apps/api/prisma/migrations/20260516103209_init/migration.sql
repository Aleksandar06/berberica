-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'active',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "default_slot_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "booking_lead_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "booking_max_days_ahead" INTEGER NOT NULL DEFAULT 60,
    "allow_guest_booking" BOOLEAN NOT NULL DEFAULT true,
    "allow_customer_cancellation" BOOLEAN NOT NULL DEFAULT true,
    "cancellation_cutoff_minutes" INTEGER NOT NULL DEFAULT 120,
    "allow_customer_reschedule" BOOLEAN NOT NULL DEFAULT true,
    "reschedule_cutoff_minutes" INTEGER NOT NULL DEFAULT 120,
    "cancellation_policy" TEXT,
    "reschedule_policy" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_branding_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "accent_color" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_branding_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
    "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "slot_duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_breaks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID,
    "exception_date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "custom_start_time" TIME(0),
    "custom_end_time" TIME(0),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exception_breaks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID,
    "exception_date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_exception_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "booking_id" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "notification_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_branding_assets_tenant_id_key" ON "tenant_branding_assets"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tenant_user_roles_tenant_id_idx" ON "tenant_user_roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_roles_user_id_tenant_id_role_key" ON "tenant_user_roles"("user_id", "tenant_id", "role");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "services_tenant_id_is_active_idx" ON "services"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_user_id_key" ON "staff_members"("user_id");

-- CreateIndex
CREATE INDEX "staff_members_tenant_id_is_active_idx" ON "staff_members"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "staff_services_tenant_id_idx" ON "staff_services"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_services_staff_member_id_service_id_key" ON "staff_services"("staff_member_id", "service_id");

-- CreateIndex
CREATE INDEX "availability_rules_tenant_id_day_of_week_is_active_idx" ON "availability_rules"("tenant_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "availability_rules_tenant_id_staff_member_id_day_of_week_is_idx" ON "availability_rules"("tenant_id", "staff_member_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "availability_breaks_tenant_id_day_of_week_is_active_idx" ON "availability_breaks"("tenant_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "availability_breaks_tenant_id_staff_member_id_day_of_week_i_idx" ON "availability_breaks"("tenant_id", "staff_member_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "availability_exceptions_tenant_id_exception_date_idx" ON "availability_exceptions"("tenant_id", "exception_date");

-- CreateIndex
CREATE INDEX "availability_exceptions_tenant_id_staff_member_id_exception_idx" ON "availability_exceptions"("tenant_id", "staff_member_id", "exception_date");

-- CreateIndex
CREATE INDEX "availability_exception_breaks_tenant_id_exception_date_idx" ON "availability_exception_breaks"("tenant_id", "exception_date");

-- CreateIndex
CREATE INDEX "availability_exception_breaks_tenant_id_staff_member_id_exc_idx" ON "availability_exception_breaks"("tenant_id", "staff_member_id", "exception_date");

-- CreateIndex
CREATE INDEX "customers_tenant_id_user_id_idx" ON "customers"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_staff_member_id_start_at_idx" ON "bookings"("tenant_id", "staff_member_id", "start_at");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_customer_id_idx" ON "bookings"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "booking_audit_logs_tenant_id_created_at_idx" ON "booking_audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_audit_logs_booking_id_idx" ON "booking_audit_logs"("booking_id");

-- CreateIndex
CREATE INDEX "notification_events_status_created_at_idx" ON "notification_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_events_tenant_id_idx" ON "notification_events"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_branding_assets" ADD CONSTRAINT "tenant_branding_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_breaks" ADD CONSTRAINT "availability_breaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_breaks" ADD CONSTRAINT "availability_breaks_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exception_breaks" ADD CONSTRAINT "availability_exception_breaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exception_breaks" ADD CONSTRAINT "availability_exception_breaks_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_audit_logs" ADD CONSTRAINT "booking_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_audit_logs" ADD CONSTRAINT "booking_audit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- RAW SQL ADDITIONS (Prisma DSL cannot express these)
--
-- Everything above is Prisma-generated. Below is hand-written and forms part
-- of the same migration so the schema is created atomically:
--
--   1. btree_gist extension — required for the booking EXCLUDE constraint.
--   2. Functional unique index on lower(tenants.slug) (case-insensitive).
--   3. CHECK constraints: slug format + reserved word block, numeric ranges,
--      temporal ranges, day_of_week ranges, etc.
--   4. Partial EXCLUDE constraint preventing overlapping ACTIVE bookings
--      (pending|confirmed) for the same (tenant_id, staff_member_id).
--
-- Why the exclusion constraint MUST be raw SQL:
--   Prisma's DSL has no primitive for EXCLUDE / GiST / range types / partial
--   constraints. PostgreSQL's exclusion constraint is the only mechanism that
--   atomically rejects overlapping inserts WITHOUT requiring application-level
--   locking. The check happens *inside* the INSERT itself, so two concurrent
--   SERIALIZABLE transactions trying to book overlapping slots cannot both
--   succeed — the second fails with a constraint-violation error. This is
--   the last line of defense behind our application-level slot validation
--   and SERIALIZABLE booking transaction; without it, a race between two
--   simultaneous requests could still produce a double-booking.
-- =============================================================================

-- 1) Extension required by the booking EXCLUDE constraint.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 2) Slug uniqueness: case-insensitive lookups via a functional unique index.
--    Coexists with Prisma's plain unique on slug (kept so the generated Prisma
--    client treats slug as @unique). The tenants_slug_lowercase_chk below
--    forces lowercase storage, making the two indexes effectively equivalent;
--    keep both so case-insensitive raw-SQL lookups still get an index scan.
CREATE UNIQUE INDEX "tenants_slug_lower_key" ON "tenants" (lower("slug"));

-- 3a) Slug format + reserved word block (defense in depth alongside the
--     application-layer guard in src/common/reserved-slugs.ts).
ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_slug_lowercase_chk"
    CHECK (slug = lower(slug)),
  ADD CONSTRAINT "tenants_slug_format_chk"
    CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  ADD CONSTRAINT "tenants_slug_reserved_chk"
    CHECK (slug NOT IN (
      'admin','api','dashboard','login','register','pricing',
      'support','terms','privacy','settings','account'
    ));

-- 3b) Numeric / temporal CHECKs Prisma cannot express.
ALTER TABLE "services"
  ADD CONSTRAINT "services_duration_minutes_positive_chk"
    CHECK (duration_minutes > 0),
  ADD CONSTRAINT "services_buffer_before_nonneg_chk"
    CHECK (buffer_before_minutes >= 0),
  ADD CONSTRAINT "services_buffer_after_nonneg_chk"
    CHECK (buffer_after_minutes >= 0);

ALTER TABLE "tenant_settings"
  ADD CONSTRAINT "tenant_settings_slot_duration_positive_chk"
    CHECK (default_slot_duration_minutes > 0),
  ADD CONSTRAINT "tenant_settings_lead_time_nonneg_chk"
    CHECK (booking_lead_time_minutes >= 0),
  ADD CONSTRAINT "tenant_settings_max_days_positive_chk"
    CHECK (booking_max_days_ahead > 0),
  ADD CONSTRAINT "tenant_settings_cancel_cutoff_nonneg_chk"
    CHECK (cancellation_cutoff_minutes >= 0),
  ADD CONSTRAINT "tenant_settings_reschedule_cutoff_nonneg_chk"
    CHECK (reschedule_cutoff_minutes >= 0);

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_day_of_week_range_chk"
    CHECK (day_of_week BETWEEN 0 AND 6),
  ADD CONSTRAINT "availability_rules_start_before_end_chk"
    CHECK (start_time < end_time),
  ADD CONSTRAINT "availability_rules_slot_duration_positive_chk"
    CHECK (slot_duration_minutes IS NULL OR slot_duration_minutes > 0);

ALTER TABLE "availability_breaks"
  ADD CONSTRAINT "availability_breaks_day_of_week_range_chk"
    CHECK (day_of_week BETWEEN 0 AND 6),
  ADD CONSTRAINT "availability_breaks_start_before_end_chk"
    CHECK (start_time < end_time);

ALTER TABLE "availability_exceptions"
  ADD CONSTRAINT "availability_exceptions_custom_times_chk"
    CHECK (
      (custom_start_time IS NULL AND custom_end_time IS NULL)
      OR
      (custom_start_time IS NOT NULL AND custom_end_time IS NOT NULL
       AND custom_start_time < custom_end_time)
    ),
  ADD CONSTRAINT "availability_exceptions_closed_no_custom_chk"
    CHECK (NOT (is_closed AND
                (custom_start_time IS NOT NULL OR custom_end_time IS NOT NULL)));

ALTER TABLE "availability_exception_breaks"
  ADD CONSTRAINT "availability_exception_breaks_start_before_end_chk"
    CHECK (start_time < end_time);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_start_before_end_chk"
    CHECK (start_at < end_at);

-- 4) THE exclusion constraint: no overlapping active bookings for the same
--    staff member within a tenant. tstzrange '[)' is half-open so a booking
--    ending exactly at 10:00 does NOT conflict with one starting at 10:00.
--    The partial WHERE keeps cancelled / completed / no_show rows out of
--    the constraint, so historical data never blocks new bookings.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap_per_staff"
    EXCLUDE USING gist (
      tenant_id        WITH =,
      staff_member_id  WITH =,
      tstzrange(start_at, end_at, '[)') WITH &&
    )
    WHERE (status IN ('pending', 'confirmed'));
