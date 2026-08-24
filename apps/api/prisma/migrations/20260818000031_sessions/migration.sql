-- CreateTable
CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash")
);

-- CreateIndex
-- Partial index for active (non-revoked) sessions. expires_at filtering happens in queries
-- since now() is stable (not immutable) and cannot appear in PostgreSQL index conditions.
CREATE INDEX "sessions_user_id_active_idx" ON "sessions"("user_id") WHERE "revoked_at" IS NULL;
