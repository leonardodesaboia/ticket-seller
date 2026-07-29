-- CreateTable
CREATE TABLE "ticket_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "price_amount" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ticket_types_price_amount_check" CHECK ("price_amount" >= 0),
    CONSTRAINT "ticket_types_capacity_check" CHECK ("capacity" > 0)
);

-- CreateIndex
CREATE INDEX "ticket_types_event_id_idx" ON "ticket_types"("event_id");
CREATE INDEX "ticket_types_organization_id_idx" ON "ticket_types"("organization_id");
CREATE INDEX "ticket_types_status_idx" ON "ticket_types"("status");

-- AddForeignKey
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
