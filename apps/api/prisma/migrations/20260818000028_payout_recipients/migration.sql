CREATE TABLE payout_recipients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL UNIQUE REFERENCES organizations(id),
  provider              TEXT        NOT NULL,
  external_recipient_id TEXT,
  status                TEXT        NOT NULL DEFAULT 'PENDING_VERIFICATION'
                                    CHECK (status IN ('PENDING_VERIFICATION','VERIFIED','REJECTED','SUSPENDED')),
  metadata              JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payout_recipients_org ON payout_recipients (organization_id);
