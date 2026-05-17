-- AlterTable: tenants gain an ISO 4217 currency code (EUR default so existing rows backfill cleanly).
ALTER TABLE "tenants" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

-- AlterTable: services gain an optional price in minor units (cents). NULL = "ask for price".
ALTER TABLE "services" ADD COLUMN "price_cents" INTEGER;
