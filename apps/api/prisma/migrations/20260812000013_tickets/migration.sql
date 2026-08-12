CREATE TABLE "tickets" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "event_id"        UUID NOT NULL,
  "order_id"        UUID NOT NULL,
  "order_item_id"   UUID NOT NULL,
  "ticket_type_id"  UUID NOT NULL,
  "unit_index"      INT NOT NULL,
  "public_code"     VARCHAR(64) NOT NULL,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "tickets_pk" PRIMARY KEY ("id"),
  CONSTRAINT "tickets_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "tickets_event_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id"),
  CONSTRAINT "tickets_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id"),
  CONSTRAINT "tickets_order_item_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id"),
  CONSTRAINT "tickets_ticket_type_fk"
    FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id"),
  CONSTRAINT "tickets_status_check"
    CHECK ("status" IN ('ACTIVE','CANCELLED')),
  CONSTRAINT "tickets_unit_index_check"
    CHECK ("unit_index" >= 0),
  CONSTRAINT "tickets_idempotency_key"
    UNIQUE ("order_item_id", "unit_index"),
  CONSTRAINT "tickets_public_code_key"
    UNIQUE ("public_code")
);

CREATE INDEX "tickets_order_id_idx"       ON "tickets"("order_id");
CREATE INDEX "tickets_org_id_idx"         ON "tickets"("organization_id");
CREATE INDEX "tickets_event_id_idx"       ON "tickets"("event_id");
CREATE INDEX "tickets_ticket_type_id_idx" ON "tickets"("ticket_type_id");
