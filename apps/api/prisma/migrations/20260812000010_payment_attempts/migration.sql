CREATE TABLE "payment_attempts" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"     UUID NOT NULL,
  "order_id"            UUID NOT NULL,
  "provider"            VARCHAR(50) NOT NULL,
  "external_payment_id" VARCHAR(255) NULL,
  "status"              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "payment_method"      VARCHAR(50) NOT NULL,
  "amount"              BIGINT NOT NULL,
  "currency"            VARCHAR(3) NOT NULL,
  "idempotency_key"     VARCHAR(255) NULL,
  "failure_code"        VARCHAR(100) NULL,
  "checkout_data"       JSONB NULL,
  "expires_at"          TIMESTAMPTZ NOT NULL,
  "version"             INT NOT NULL DEFAULT 1,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "payment_attempts_pk" PRIMARY KEY ("id"),
  CONSTRAINT "payment_attempts_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "payment_attempts_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id"),
  CONSTRAINT "payment_attempts_status_check"
    CHECK ("status" IN ('PENDING','PROCESSING','APPROVED','DECLINED','CANCELLED','EXPIRED')),
  CONSTRAINT "payment_attempts_idempotency_key_key"
    UNIQUE ("idempotency_key")
);

CREATE UNIQUE INDEX "payment_attempts_external_id_idx"
  ON "payment_attempts"("external_payment_id")
  WHERE "external_payment_id" IS NOT NULL;

CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts"("order_id");
CREATE INDEX "payment_attempts_org_id_idx" ON "payment_attempts"("organization_id");
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");
CREATE INDEX "payment_attempts_expires_at_idx" ON "payment_attempts"("expires_at");
