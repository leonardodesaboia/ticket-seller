CREATE TABLE media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  uploader_id UUID NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  content_type VARCHAR(128) NOT NULL,
  size_bytes BIGINT,
  purpose VARCHAR(64) NOT NULL
    CHECK (purpose IN ('EVENT_COVER','ORG_LOGO')),
  entity_id UUID NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','CONFIRMED','ORPHANED')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX media_uploads_org_entity ON media_uploads(organization_id, entity_id);
CREATE INDEX media_uploads_status_created ON media_uploads(status, created_at)
  WHERE status = 'PENDING';

ALTER TABLE events ADD COLUMN cover_image_key TEXT;
