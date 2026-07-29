# TASK-012 — CreateOrganization: Completion Report

**Status:** COMPLETED  
**Branch:** `main`  
**Date:** 2026-07-29

---

## Scope

Full hexagonal module for organization creation: POST /api/v1/organizations.

---

## What Was Implemented

### Domain
- `Organization` entity (id, name, slug, status, ownerId, createdAt)
- `SlugAlreadyInUseError extends Error`
- `IOrganizationRepository` port with `create` and `existsBySlug`

### Application
- `CreateOrganizationUseCase`: validates slug pattern (`/^[a-z0-9]+(?:-[a-z0-9]+)*/`), checks slug uniqueness, calls repository

### Infrastructure
- `PrismaOrganizationRepository`: uses `$transaction([createOrg, createMember, createOutboxEvent])` atomically; catches Prisma P2002 → `SlugAlreadyInUseError`

### Presentation
- `CreateOrganizationDto` (class-validator: name required, slug pattern)
- `OrganizationResponse.from(org)` static factory
- `OrganizationsController`: POST `/organizations`, guarded by `ActorGuard`, maps domain errors to HTTP

### Module
- `OrganizationsModule` imports `HttpModule`, provides use case and repository

### Tests
- 6 integration tests via Testcontainers: 201 create + OWNER member, 409 duplicate slug, 401 no header, 400 empty name, 400 bad slug, outbox event written

---

## Invariants Enforced

- Owner automatically added as ACTIVE OWNER member.
- `organization.created.v1` outbox event written atomically with org creation.
- Slug is lowercase-only (`/^[a-z0-9]+(?:-[a-z0-9]+)*/`).
