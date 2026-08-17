-- Add REFUNDED and CHARGEBACK to the orders status constraint.
-- REFUNDED was missing from the 20260817000019_refund_attempts migration.
-- CHARGEBACK is introduced in this migration for payment disputes.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING_PAYMENT','PAID','TICKETS_ISSUED','CANCELLED','EXPIRED','REFUNDED','CHARGEBACK'));

CREATE TABLE payment_disputes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL,
  order_id            UUID        NOT NULL REFERENCES orders(id),
  payment_attempt_id  UUID        REFERENCES payment_attempts(id),
  provider            TEXT        NOT NULL,
  external_dispute_id TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'OPEN',
  amount              BIGINT,
  currency            TEXT,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX payment_disputes_provider_external_id
  ON payment_disputes (provider, external_dispute_id);

CREATE INDEX payment_disputes_organization_id ON payment_disputes (organization_id);
CREATE INDEX payment_disputes_order_id ON payment_disputes (order_id);
