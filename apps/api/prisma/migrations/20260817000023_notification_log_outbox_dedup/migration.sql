-- Add unique index on outbox_event_id so ON CONFLICT DO NOTHING works for
-- events without orderId (e.g. event.cancelled.v1, order.chargeback.v1).
-- Without this index, the partial unique index on (order_id, event_type)
-- does not activate for NULL order_id rows and duplicate notifications can
-- be inserted when multiple worker instances race.
CREATE UNIQUE INDEX notification_log_outbox_event_id
  ON notification_log (outbox_event_id)
  WHERE outbox_event_id IS NOT NULL;
