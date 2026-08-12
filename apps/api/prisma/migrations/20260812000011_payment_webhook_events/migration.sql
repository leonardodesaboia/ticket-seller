CREATE TABLE "payment_webhook_events" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider"            VARCHAR(50) NOT NULL,
  "provider_event_id"   VARCHAR(255) NOT NULL,
  "payment_attempt_id"  UUID NULL,
  "external_payment_id" VARCHAR(255) NOT NULL,
  "event_type"          VARCHAR(100) NOT NULL,
  "raw_status"          VARCHAR(100) NOT NULL,
  "amount"              BIGINT NULL,
  "currency"            VARCHAR(3) NULL,
  "processed_at"        TIMESTAMPTZ NULL,
  "failed_at"           TIMESTAMPTZ NULL,
  "error_message"       TEXT NULL,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "payment_webhook_events_pk" PRIMARY KEY ("id"),
  CONSTRAINT "payment_webhook_events_attempt_fk"
    FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id"),
  CONSTRAINT "payment_webhook_events_provider_event_key"
    UNIQUE ("provider", "provider_event_id")
);

CREATE INDEX "pwe_external_id_idx" ON "payment_webhook_events"("external_payment_id");
CREATE INDEX "pwe_attempt_id_idx"   ON "payment_webhook_events"("payment_attempt_id");
CREATE INDEX "pwe_processed_at_idx" ON "payment_webhook_events"("processed_at");
