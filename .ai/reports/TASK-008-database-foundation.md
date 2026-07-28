# TASK-008 — Database Foundation: Completion Report

**Status:** COMPLETED  
**Branch:** `feature/TASK-008-database-foundation`  
**Worktree:** `../ticket-seller-task-008`  
**Date:** 2026-07-28

---

## Scope

Establish Prisma v5 + PostgreSQL as the data persistence layer for the API, following the `platform/` hexagonal structure defined in TASK-007.

---

## What Was Implemented

### 1. Schema (`apps/api/prisma/schema.prisma`)

7 foundational tables modeled in Prisma:

| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Core identity, soft-delete |
| `Identity` | `identities` | OAuth provider links |
| `Organization` | `organizations` | Multi-tenant entity, soft-delete |
| `OrganizationMember` | `organization_members` | Role + status per member |
| `IdempotencyRecord` | `idempotency_records` | API idempotency |
| `OutboxEvent` | `outbox_events` | Transactional outbox |
| `AuditEntry` | `audit_entries` | Immutable audit log |

All UUIDs use `gen_random_uuid()`. All timestamps use `TIMESTAMPTZ`. All tables follow `snake_case` mapping.

### 2. Migrations (3 files in `apps/api/prisma/migrations/`)

- `20260728000001_foundation_users` — `users` + `identities`
- `20260728000002_foundation_organizations` — `organizations` + `organization_members`
- `20260728000003_foundation_infrastructure` — `idempotency_records` + `outbox_events` + `audit_entries`

Each migration is a standalone SQL file with all DDL, indexes, and foreign keys.

### 3. `PrismaService` (`apps/api/src/platform/database/prisma.service.ts`)

- Extends `PrismaClient`
- Implements `OnModuleInit` (`$connect`) and `OnModuleDestroy` (`$disconnect`) for graceful lifecycle
- Exported via `DatabaseModule` (`@Global()`)

### 4. `DatabaseModule` (`apps/api/src/platform/database/prisma.module.ts`)

- `@Global()` — available to all modules without re-importing
- Exports `PrismaService`

### 5. Updated `env.ts`

Added `DATABASE_URL: z.string().url()` — validated at startup via Zod.

### 6. Real DB Health Check (`/health/ready`)

`HealthController.ready()` now runs `SELECT 1` via `PrismaService.$queryRaw`. Returns:
- `200 { status: 'ok' }` when DB is reachable
- `503 ServiceUnavailableException('database')` when DB is unreachable

### 7. `AppModule` updated

Imports `DatabaseModule` before `HealthModule`.

### 8. Integration Tests (`apps/api/test/integration/database.integration-spec.ts`)

Uses `@testcontainers/postgresql` with `postgres:16-alpine`. Runs `prisma migrate deploy` inside the container before tests.

5 tests:
- Connectivity (`SELECT 1`)
- User insert/query with default field values
- Unique constraint enforcement
- Organization + member insert with FK integrity
- All 7 tables accessible

### 9. `jest.integration.config.ts`

Separate Jest config for integration tests with `testTimeout: 60000`.

### 10. `package.json` scripts added

```json
"test:integration": "jest --config jest.integration.config.ts --forceExit",
"db:generate": "prisma generate",
"db:migrate": "prisma migrate deploy"
```

Added `"prisma": { "schema": "prisma/schema.prisma" }` field.

### 11. E2E test updated

`health.e2e-spec.ts` now mocks `PrismaService` via `overrideProvider` — adds test for 503 case.

---

## Blockers Resolved

| Issue | Root Cause | Fix |
|---|---|---|
| `prisma generate` failing with `pnpm add` error | Schema at workspace root; Prisma tried to self-install in root without app `package.json` context | Moved `prisma/` into `apps/api/prisma/` |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm 11 blocked build scripts | Added `allowBuilds` entries in `pnpm-workspace.yaml` |
| Prisma v7 installed | `pnpm add prisma` resolved to v7 with breaking changes | Pinned `prisma@^5.22.0` and `@prisma/client@^5.22.0` |
| `module` variable collision in test | Jest global `module` conflicts with local variable | Renamed to `testingModule` |
| Raw query BigInt mismatch | Prisma returns `number` not `BigInt` for `SELECT 1` | Changed assertion to `Number(result[0]?.one)` |

---

## Validation Results

```
✓ pnpm format:check      — all files formatted
✓ pnpm lint (api)        — no ESLint errors
✓ pnpm typecheck (api)   — TypeScript clean
✓ pnpm test (api)        — 3/3 e2e tests pass
✓ pnpm test:integration  — 5/5 integration tests pass (Testcontainers)
```

---

## Files Created / Modified

| Path | Action |
|---|---|
| `apps/api/prisma/schema.prisma` | Created (moved from workspace root) |
| `apps/api/prisma/migrations/migration_lock.toml` | Created |
| `apps/api/prisma/migrations/20260728000001_foundation_users/migration.sql` | Created |
| `apps/api/prisma/migrations/20260728000002_foundation_organizations/migration.sql` | Created |
| `apps/api/prisma/migrations/20260728000003_foundation_infrastructure/migration.sql` | Created |
| `apps/api/src/platform/database/prisma.service.ts` | Created |
| `apps/api/src/platform/database/prisma.module.ts` | Created |
| `apps/api/src/platform/config/env.ts` | Modified (DATABASE_URL added) |
| `apps/api/src/platform/health/health.controller.ts` | Modified (real DB check) |
| `apps/api/src/platform/health/health.module.ts` | Modified (imports DatabaseModule) |
| `apps/api/src/app.module.ts` | Modified (imports DatabaseModule) |
| `apps/api/test/e2e/health.e2e-spec.ts` | Modified (PrismaService mock, 503 test) |
| `apps/api/test/integration/database.integration-spec.ts` | Created |
| `apps/api/jest.integration.config.ts` | Created |
| `apps/api/jest.env.ts` | Modified (DATABASE_URL fallback) |
| `apps/api/package.json` | Modified (scripts, prisma field, devDeps) |
| `pnpm-workspace.yaml` | Modified (allowBuilds) |
