CREATE TABLE fee_policies (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        REFERENCES organizations(id),
  platform_fee_bps      INTEGER     NOT NULL DEFAULT 0
                                    CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000),
  processing_fee_bps    INTEGER     CHECK (processing_fee_bps >= 0),
  refund_fee_policy     TEXT        NOT NULL DEFAULT 'TBD'
                                    CHECK (refund_fee_policy IN ('RETAIN','REFUND','PROPORTIONAL','TBD')),
  settlement_delay_days INTEGER     NOT NULL DEFAULT 7
                                    CHECK (settlement_delay_days >= 0),
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX fee_policies_active_global
  ON fee_policies (is_active)
  WHERE organization_id IS NULL AND is_active = true;

CREATE INDEX fee_policies_org
  ON fee_policies (organization_id)
  WHERE organization_id IS NOT NULL;

-- Seed: política global 0 bps (TBD commercial)
INSERT INTO fee_policies (platform_fee_bps, refund_fee_policy, settlement_delay_days, is_active)
VALUES (0, 'TBD', 7, true)
ON CONFLICT DO NOTHING;
