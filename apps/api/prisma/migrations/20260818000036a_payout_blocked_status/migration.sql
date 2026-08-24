-- Add 'BLOCKED' to the payouts status CHECK constraint.
-- The original inline CHECK on the status column was auto-named by PostgreSQL
-- following the convention: <table>_<column>_check → payouts_status_check.
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('SCHEDULED','HELD','PROCESSING','PAID','FAILED','CANCELLED','REVERSED','BLOCKED'));
