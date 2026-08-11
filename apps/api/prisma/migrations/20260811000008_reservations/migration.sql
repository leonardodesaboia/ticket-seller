CREATE TABLE "reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "continuation_token_hash" VARCHAR(64) NOT NULL,
  "idempotency_key" VARCHAR(255),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "subtotal_amount" BIGINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "reservations_pk" PRIMARY KEY ("id"),
  CONSTRAINT "reservations_event_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id"),
  CONSTRAINT "reservations_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "reservations_status_check" CHECK ("status" IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED'))
);

CREATE UNIQUE INDEX "reservations_idempotency_key_key" ON "reservations"("idempotency_key");
CREATE INDEX "reservations_organization_event_idx" ON "reservations"("organization_id", "event_id");
CREATE INDEX "reservations_expires_at_idx" ON "reservations"("expires_at");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

CREATE TABLE "reservation_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reservation_id" UUID NOT NULL,
  "ticket_type_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "name_snapshot" VARCHAR(500) NOT NULL,
  "unit_price_amount" BIGINT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "subtotal_amount" BIGINT NOT NULL,
  CONSTRAINT "reservation_items_pk" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_items_reservation_fk" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id"),
  CONSTRAINT "reservation_items_ticket_type_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id"),
  CONSTRAINT "reservation_items_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX "reservation_items_reservation_id_idx" ON "reservation_items"("reservation_id");
CREATE INDEX "reservation_items_ticket_type_id_idx" ON "reservation_items"("ticket_type_id");
