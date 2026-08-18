CREATE TABLE seller_balances (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL UNIQUE REFERENCES organizations(id),
  pending_amount    BIGINT      NOT NULL DEFAULT 0,
  available_amount  BIGINT      NOT NULL DEFAULT 0,
  reserved_amount   BIGINT      NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
  currency          TEXT        NOT NULL DEFAULT 'BRL',
  version           INTEGER     NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE balance_settlements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        NOT NULL UNIQUE REFERENCES orders(id),
  organization_id   UUID        NOT NULL REFERENCES organizations(id),
  seller_net_amount BIGINT      NOT NULL,
  currency          TEXT        NOT NULL,
  settled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX balance_settlements_org ON balance_settlements (organization_id);
CREATE INDEX balance_settlements_settled ON balance_settlements (settled_at DESC);
