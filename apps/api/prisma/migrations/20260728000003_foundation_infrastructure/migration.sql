-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "payload" JSONB NOT NULL,
    "organization_id" UUID,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_idempotency_key_key" ON "idempotency_records"("idempotency_key");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_idx" ON "outbox_events"("processed_at");

-- CreateIndex
CREATE INDEX "outbox_events_organization_id_idx" ON "outbox_events"("organization_id");

-- CreateIndex
CREATE INDEX "audit_entries_organization_id_occurred_at_idx" ON "audit_entries"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_entries_resource_type_resource_id_idx" ON "audit_entries"("resource_type", "resource_id");
