CREATE TABLE "ticket_credentials" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_id"       UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "token_hash"      VARCHAR(64) NOT NULL,
  "status"          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "version"         INT NOT NULL DEFAULT 1,
  "issued_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revoked_at"      TIMESTAMPTZ NULL,

  CONSTRAINT "ticket_credentials_pk"           PRIMARY KEY ("id"),
  CONSTRAINT "ticket_credentials_ticket_fk"    FOREIGN KEY ("ticket_id")       REFERENCES "tickets"("id"),
  CONSTRAINT "ticket_credentials_org_fk"       FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  CONSTRAINT "ticket_credentials_token_key"    UNIQUE ("token_hash"),
  CONSTRAINT "ticket_credentials_status_check" CHECK ("status" IN ('ACTIVE','REVOKED'))
);

-- No máximo uma credencial ACTIVE por ticket
CREATE UNIQUE INDEX "ticket_credentials_active_per_ticket"
  ON "ticket_credentials"("ticket_id") WHERE "status" = 'ACTIVE';

CREATE INDEX "ticket_credentials_ticket_id_idx" ON "ticket_credentials"("ticket_id");
CREATE INDEX "ticket_credentials_org_id_idx"    ON "ticket_credentials"("organization_id");
