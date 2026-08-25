-- Prevent concurrent active payment attempts for the same order.
-- Without this, two simultaneous requests could both pass the
-- findActiveByOrderId check and create duplicate PENDING/PROCESSING attempts.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_unique_active_per_order
  ON payment_attempts (order_id)
  WHERE status IN ('PENDING', 'PROCESSING');
