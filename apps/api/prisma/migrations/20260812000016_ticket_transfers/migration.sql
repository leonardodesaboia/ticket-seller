CREATE TABLE ticket_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        UUID NOT NULL REFERENCES tickets(id),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  claim_token_hash VARCHAR(64) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  expires_at       TIMESTAMPTZ NOT NULL,
  accepted_at      TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ticket_transfers_pending_unique
  ON ticket_transfers(ticket_id)
  WHERE status = 'PENDING';

CREATE INDEX ticket_transfers_organization_idx ON ticket_transfers(organization_id);
CREATE INDEX ticket_transfers_claim_hash_idx ON ticket_transfers(claim_token_hash);
