-- AlterTable: add email_verified to identities
ALTER TABLE "identities" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "password_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "hash" TEXT NOT NULL,
  "algorithm" VARCHAR(32) NOT NULL DEFAULT 'argon2id',
  "force_reset" BOOLEAN NOT NULL DEFAULT false,
  "last_changed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "password_credentials_user_id_key" UNIQUE ("user_id")
);
