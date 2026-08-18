-- CreateTable
CREATE TABLE "authentication_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL,
  "ip" TEXT NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "authentication_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authentication_attempts_outcome_check" CHECK ("outcome" IN ('SUCCESS','FAILURE','LOCKED'))
);

-- CreateIndex
CREATE INDEX "auth_attempts_email_ip_idx" ON "authentication_attempts"("email", "ip", "attempted_at" DESC);
