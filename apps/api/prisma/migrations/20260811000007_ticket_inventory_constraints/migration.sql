ALTER TABLE "ticket_inventory"
  ADD CONSTRAINT "ticket_inventory_capacity_positive"
    CHECK ("capacity" > 0),
  ADD CONSTRAINT "ticket_inventory_organization_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
