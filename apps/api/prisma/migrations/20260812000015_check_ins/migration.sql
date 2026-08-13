CREATE TABLE "check_ins" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id"      UUID NOT NULL,
  "event_id"             UUID NOT NULL,
  "ticket_id"            UUID NOT NULL,
  "credential_id"        UUID NOT NULL,
  "performed_by_user_id" UUID NULL,
  "result"               VARCHAR(30) NOT NULL,
  "idempotency_key"      VARCHAR(100) NULL,
  "checked_in_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "source"               VARCHAR(20) NOT NULL DEFAULT 'SCANNER',
  "notes"                TEXT NULL,

  CONSTRAINT "check_ins_pk"              PRIMARY KEY ("id"),
  CONSTRAINT "check_ins_org_fk"          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "check_ins_event_fk"        FOREIGN KEY ("event_id")        REFERENCES "events"("id"),
  CONSTRAINT "check_ins_ticket_fk"       FOREIGN KEY ("ticket_id")       REFERENCES "tickets"("id"),
  CONSTRAINT "check_ins_credential_fk"   FOREIGN KEY ("credential_id")   REFERENCES "ticket_credentials"("id"),
  CONSTRAINT "check_ins_result_check"    CHECK ("result" IN ('ADMITTED','ALREADY_CHECKED_IN','INVALID_CREDENTIAL','TICKET_CANCELLED','EVENT_NOT_ACTIVE','WRONG_EVENT','TRANSFER_PENDING')),
  CONSTRAINT "check_ins_source_check"    CHECK ("source" IN ('SCANNER','MANUAL')),
  CONSTRAINT "check_ins_idempotency_key" UNIQUE ("idempotency_key")
);

-- Heart: maximum 1 ADMITTED per ticket
CREATE UNIQUE INDEX "check_ins_single_entry_idx"
  ON "check_ins"("ticket_id") WHERE "result" = 'ADMITTED';

CREATE INDEX "check_ins_event_id_idx"  ON "check_ins"("event_id");
CREATE INDEX "check_ins_ticket_id_idx" ON "check_ins"("ticket_id");
CREATE INDEX "check_ins_org_id_idx"    ON "check_ins"("organization_id");
