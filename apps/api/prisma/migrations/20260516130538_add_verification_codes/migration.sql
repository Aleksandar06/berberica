-- CreateEnum
CREATE TYPE "verification_purpose" AS ENUM ('account_email', 'guest_otp', 'guest_grant');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "require_verified_account_for_booking" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "purpose" "verification_purpose" NOT NULL,
    "target_email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "intent_hash" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_codes_target_email_purpose_idx" ON "verification_codes"("target_email", "purpose");

-- CreateIndex
CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes"("expires_at");

-- CreateIndex
CREATE INDEX "verification_codes_tenant_id_target_email_purpose_idx" ON "verification_codes"("tenant_id", "target_email", "purpose");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
