-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "postal_code" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venues_organization_id_idx" ON "venues"("organization_id");

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add schedule, venue, and currency to events
ALTER TABLE "events"
    ADD COLUMN "format" VARCHAR(50),
    ADD COLUMN "starts_at" TIMESTAMPTZ,
    ADD COLUMN "ends_at" TIMESTAMPTZ,
    ADD COLUMN "timezone" VARCHAR(100),
    ADD COLUMN "online_info" TEXT,
    ADD COLUMN "venue_id" UUID,
    ADD COLUMN "currency" VARCHAR(3);

-- AddCheckConstraint: format
ALTER TABLE "events"
    ADD CONSTRAINT "events_format_check"
    CHECK ("format" IS NULL OR "format" IN ('IN_PERSON', 'ONLINE', 'HYBRID'));

-- AddCheckConstraint: ends_at after starts_at
ALTER TABLE "events"
    ADD CONSTRAINT "events_ends_after_starts_check"
    CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "events_venue_id_idx" ON "events"("venue_id");
