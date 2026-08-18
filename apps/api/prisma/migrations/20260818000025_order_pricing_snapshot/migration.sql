CREATE TABLE order_pricing_snapshots (
  order_id                UUID        PRIMARY KEY REFERENCES orders(id),
  fee_policy_id           UUID        NOT NULL REFERENCES fee_policies(id),
  gross_amount            BIGINT      NOT NULL,
  currency                TEXT        NOT NULL,
  platform_fee_bps        INTEGER     NOT NULL DEFAULT 0,
  platform_fee_amount     BIGINT      NOT NULL DEFAULT 0,
  processing_fee_bps      INTEGER,
  processing_fee_amount   BIGINT      NOT NULL DEFAULT 0,
  refund_fee_policy       TEXT        NOT NULL
                                      CHECK (refund_fee_policy IN ('RETAIN','REFUND','PROPORTIONAL','TBD')),
  seller_net_amount       BIGINT      NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (gross_amount = platform_fee_amount + processing_fee_amount + seller_net_amount),
  CHECK (platform_fee_amount >= 0),
  CHECK (processing_fee_amount >= 0),
  CHECK (seller_net_amount >= 0),
  CHECK (gross_amount > 0)
);

CREATE INDEX order_pricing_snapshots_policy ON order_pricing_snapshots (fee_policy_id);
