-- Add composite index on ledger_entries (account_id, occurred_at DESC) to support
-- keyset pagination cursor queries in list-ledger-transactions without sequential scans.
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_occurred
    ON ledger_entries (account_id, occurred_at DESC);
