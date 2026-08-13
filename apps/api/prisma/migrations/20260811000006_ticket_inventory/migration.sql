CREATE TABLE "ticket_inventory" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_type_id"  UUID NOT NULL,
  "event_id"        UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "capacity"        INTEGER NOT NULL,
  "reserved"        INTEGER NOT NULL DEFAULT 0,
  "committed"       INTEGER NOT NULL DEFAULT 0,
  "version"         INTEGER NOT NULL DEFAULT 1,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "ticket_inventory_pk" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_inventory_ticket_type_fk"
    FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id"),
  CONSTRAINT "ticket_inventory_event_fk"
    FOREIGN KEY ("event_id") REFERENCES "events"("id"),
  CONSTRAINT "ticket_inventory_available_gte_zero"
    CHECK ("capacity" - "reserved" - "committed" >= 0),
  CONSTRAINT "ticket_inventory_reserved_gte_zero"
    CHECK ("reserved" >= 0),
  CONSTRAINT "ticket_inventory_committed_gte_zero"
    CHECK ("committed" >= 0),
  CONSTRAINT "ticket_inventory_reserved_committed_lte_capacity"
    CHECK ("reserved" + "committed" <= "capacity")
);

CREATE UNIQUE INDEX "ticket_inventory_ticket_type_id_key"
  ON "ticket_inventory"("ticket_type_id");
CREATE INDEX "ticket_inventory_event_id_idx"
  ON "ticket_inventory"("event_id");
CREATE INDEX "ticket_inventory_organization_id_idx"
  ON "ticket_inventory"("organization_id");
