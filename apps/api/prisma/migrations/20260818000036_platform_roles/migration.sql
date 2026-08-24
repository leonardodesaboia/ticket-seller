ALTER TABLE users
  ADD COLUMN platform_role VARCHAR(32),
  ADD COLUMN suspended_at TIMESTAMPTZ,
  ADD CONSTRAINT chk_platform_role CHECK (
    platform_role IS NULL OR platform_role IN ('PLATFORM_SUPPORT','PLATFORM_ADMIN')
  );

ALTER TABLE organizations
  ADD COLUMN suspended_at TIMESTAMPTZ;
