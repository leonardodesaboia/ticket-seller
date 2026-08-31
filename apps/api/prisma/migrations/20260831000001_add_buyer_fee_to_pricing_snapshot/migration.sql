-- TASK-070: Add buyer fee columns to order_pricing_snapshots and fee_policies.
-- Both columns use DEFAULT 0 so the ALTER runs without a table rewrite on PostgreSQL 11+.
-- Existing rows remain valid with buyer_fee = 0 (no buyer fee charged at time of sale).

ALTER TABLE order_pricing_snapshots
  ADD COLUMN IF NOT EXISTS buyer_fee_bps    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_fee_amount BIGINT  NOT NULL DEFAULT 0;

ALTER TABLE fee_policies
  ADD COLUMN IF NOT EXISTS buyer_fee_bps INTEGER NOT NULL DEFAULT 0;
