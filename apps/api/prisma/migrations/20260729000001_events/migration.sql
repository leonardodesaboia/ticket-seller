-- Migration: 20260729000001_events
-- Creates the events table. Additive, non-destructive.

CREATE TABLE events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title           VARCHAR(500)  NOT NULL,
  description     TEXT,
  status          VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
  slug            VARCHAR(500),
  metadata        JSONB,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_organization_id ON events(organization_id);
CREATE INDEX idx_events_status ON events(status);
CREATE UNIQUE INDEX idx_events_slug ON events(slug) WHERE slug IS NOT NULL;
