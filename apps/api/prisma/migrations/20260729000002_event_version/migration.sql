-- Migration: add version column to events for optimistic concurrency control
ALTER TABLE "events" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
