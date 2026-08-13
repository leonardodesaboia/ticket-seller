-- orders: cancellation fields
ALTER TABLE orders
  ADD COLUMN cancelled_at        TIMESTAMPTZ,
  ADD COLUMN cancellation_reason VARCHAR(255),
  ADD COLUMN cancellation_source VARCHAR(30);

ALTER TABLE orders ADD CONSTRAINT orders_cancelled_consistency
  CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
    (status <> 'CANCELLED')
  );

CREATE INDEX orders_cancelled_at_idx ON orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- tickets: cancellation timestamp
ALTER TABLE tickets
  ADD COLUMN cancelled_at TIMESTAMPTZ;

ALTER TABLE tickets ADD CONSTRAINT tickets_cancelled_consistency
  CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
    (status <> 'CANCELLED')
  );
