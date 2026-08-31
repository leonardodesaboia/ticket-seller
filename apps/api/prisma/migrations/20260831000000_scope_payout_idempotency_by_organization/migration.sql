-- An idempotency key represents a client operation within one organization.
-- Global uniqueness can return a payout from another tenant on a key collision.
ALTER TABLE payouts
  DROP CONSTRAINT IF EXISTS payouts_idempotency_key_key;

ALTER TABLE payouts
  ADD CONSTRAINT payouts_organization_id_idempotency_key_key
  UNIQUE (organization_id, idempotency_key);
