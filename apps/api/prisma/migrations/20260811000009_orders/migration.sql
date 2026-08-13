CREATE TABLE "orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
  "currency" VARCHAR(3) NOT NULL,
  "subtotal_amount" BIGINT NOT NULL,
  "total_amount" BIGINT NOT NULL,
  "idempotency_key" VARCHAR(255),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "orders_pk" PRIMARY KEY ("id"),
  CONSTRAINT "orders_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "orders_event_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id"),
  CONSTRAINT "orders_reservation_fk" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id"),
  CONSTRAINT "orders_status_check" CHECK ("status" IN ('PENDING_PAYMENT', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "orders_total_not_less_than_subtotal" CHECK ("total_amount" >= "subtotal_amount")
);

CREATE UNIQUE INDEX "orders_reservation_id_key" ON "orders"("reservation_id");
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
CREATE INDEX "orders_organization_id_idx" ON "orders"("organization_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_expires_at_idx" ON "orders"("expires_at");

CREATE TABLE "order_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "ticket_type_id" UUID NOT NULL,
  "name_snapshot" VARCHAR(500) NOT NULL,
  "unit_price_amount" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "subtotal_amount" BIGINT NOT NULL,
  CONSTRAINT "order_items_pk" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id"),
  CONSTRAINT "order_items_ticket_type_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id"),
  CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "order_items_subtotal_matches_quantity" CHECK ("subtotal_amount" = "unit_price_amount" * "quantity")
);

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
