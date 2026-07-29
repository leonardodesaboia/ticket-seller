# TASK-013 — CreateEvent + GetEvent: Completion Report

**Status:** COMPLETED  
**Branch:** `main`  
**Date:** 2026-07-29

---

## Scope

Full hexagonal module for event creation and retrieval: POST and GET /api/v1/organizations/:organizationId/events[/:eventId].

---

## What Was Implemented

### Migration
- `20260729000001_events/migration.sql`: creates `events` table with FK to organizations, indexes on `organization_id` and `status`, partial unique on `slug WHERE slug IS NOT NULL`

### Domain
- `Event` entity (id, organizationId, title, description, status, createdAt, updatedAt)
- `EventNotFoundError`, `OrganizationAccessDeniedError`, `InsufficientRoleError`
- `IEventRepository` port: `create`, `findByOrganizationAndId`
- `IOrganizationAccessPort` port: `findMember(organizationId, userId)` → `OrganizationMemberInfo | null`
- `EVENT_CREATOR_ROLES = ['OWNER', 'ADMIN', 'EVENT_MANAGER']`

### Application
- `CreateEventUseCase`: verifies ACTIVE membership, checks role against `EVENT_CREATOR_ROLES`, creates event
- `GetEventUseCase`: verifies ACTIVE membership (any role), fetches event by `(organizationId, eventId)`
- 11 unit tests (6 for create, 5 for get)

### Infrastructure
- `PrismaEventRepository`: `create` and `findByOrganizationAndId` using `prisma.event`
- `PrismaOrganizationAccessAdapter`: queries `organizationMember` by `(organizationId, userId)`

### Presentation
- `CreateEventDto` (title required/max 500, description optional/max 5000)
- `EventResponse.from(event)` static factory
- `EventsController`: POST `organizations/:organizationId/events` (201), GET `organizations/:organizationId/events/:eventId` (200); maps domain errors to 401/403/404

### Module
- `EventsModule` imports `HttpModule`, provides both use cases and both port implementations

### Tests
- 11 integration tests via Testcontainers: 201 create DRAFT, 201 with description, 401 no header, 404 not a member, 403 VIEWER role, 400 empty title, 200 get event, 401 get no header, 404 get not member, 404 event missing, 404 cross-org isolation

---

## Invariants Enforced

- Events are created with status `DRAFT`.
- All event queries use `(organizationId, eventId)` — never eventId alone.
- `IOrganizationAccessPort` is a domain port; events module never imports organizations module internals.
- Only OWNER, ADMIN, EVENT_MANAGER can create events; any ACTIVE member can read.
