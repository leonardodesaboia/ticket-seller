ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Partial index: somente eventos CANCELLED aparecem aqui
CREATE INDEX IF NOT EXISTS events_cancelled_at_idx
  ON events (cancelled_at)
  WHERE cancelled_at IS NOT NULL;
