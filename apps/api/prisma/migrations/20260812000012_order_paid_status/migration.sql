ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_status_check"
    CHECK ("status" IN ('PENDING_PAYMENT','PAID','TICKETS_ISSUED','CANCELLED','EXPIRED'));
