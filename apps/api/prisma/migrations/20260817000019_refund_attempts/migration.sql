CREATE TABLE refund_attempts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL,
  order_id            UUID        NOT NULL REFERENCES orders(id),
  payment_attempt_id  UUID        REFERENCES payment_attempts(id),
  idempotency_key     TEXT        NOT NULL,
  external_refund_id  TEXT,
  amount              BIGINT      NOT NULL,
  currency            TEXT        NOT NULL DEFAULT 'BRL',
  status              TEXT        NOT NULL DEFAULT 'PENDING',
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX refund_attempts_order_idempotency_key
  ON refund_attempts (order_id, idempotency_key);

CREATE INDEX refund_attempts_organization_id
  ON refund_attempts (organization_id);

CREATE INDEX refund_attempts_order_id
  ON refund_attempts (order_id);
