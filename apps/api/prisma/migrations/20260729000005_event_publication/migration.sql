-- Additive publication foundation for events.
ALTER TABLE "events"
    ADD COLUMN "published_at" TIMESTAMPTZ;

ALTER TABLE "events"
    ADD CONSTRAINT "events_status_check"
    CHECK (
        "status" IN (
            'DRAFT',
            'PUBLISHED',
            'PAUSED',
            'CANCELLED',
            'COMPLETED'
        )
    );

ALTER TABLE "events"
    ADD CONSTRAINT "events_published_fields_check"
    CHECK (
        "status" <> 'PUBLISHED'
        OR (
            "slug" IS NOT NULL
            AND length(btrim("slug")) > 0
            AND "published_at" IS NOT NULL
        )
    );

CREATE INDEX "events_published_starts_at_id_idx"
    ON "events" ("starts_at" ASC, "id" ASC)
    WHERE "status" = 'PUBLISHED';
