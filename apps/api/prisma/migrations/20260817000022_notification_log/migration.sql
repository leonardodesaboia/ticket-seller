CREATE TABLE notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  order_id        UUID,
  event_type      TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outbox_event_id UUID REFERENCES outbox_events(id)
);

CREATE UNIQUE INDEX notification_log_order_event_type
  ON notification_log (order_id, event_type)
  WHERE order_id IS NOT NULL;

CREATE INDEX notification_log_organization_id ON notification_log (organization_id);
