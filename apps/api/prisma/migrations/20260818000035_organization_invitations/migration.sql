CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  inviter_id UUID NOT NULL REFERENCES users(id),
  email VARCHAR(320) NOT NULL,
  role VARCHAR(64) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_invitation_role CHECK (role IN ('OWNER','ADMIN','FINANCE','EVENT_MANAGER','CHECK_IN_STAFF'))
);
CREATE INDEX organization_invitations_org_pending ON organization_invitations(organization_id, used_at, revoked_at);
