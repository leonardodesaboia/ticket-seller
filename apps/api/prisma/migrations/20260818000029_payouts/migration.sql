CREATE TABLE payouts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id),
  recipient_id        UUID        NOT NULL REFERENCES payout_recipients(id),
  amount              BIGINT      NOT NULL CHECK (amount > 0),
  currency            TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'SCHEDULED'
                                  CHECK (status IN ('SCHEDULED','HELD','PROCESSING','PAID','FAILED','CANCELLED','REVERSED')),
  provider            TEXT        NOT NULL,
  external_payout_id  TEXT,
  idempotency_key     TEXT        NOT NULL UNIQUE,
  failure_reason      TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payouts_org ON payouts (organization_id);
CREATE INDEX payouts_external ON payouts (external_payout_id) WHERE external_payout_id IS NOT NULL;
CREATE INDEX payouts_status ON payouts (status, requested_at DESC);

CREATE TABLE payout_webhook_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT        NOT NULL,
  provider_event_id TEXT        NOT NULL,
  payout_id         UUID        REFERENCES payouts(id),
  raw_payload       JSONB       NOT NULL,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX payout_webhook_events_payout ON payout_webhook_events (payout_id);
