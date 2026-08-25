# Fixes Session 2 — 2026-08-24

All 439 tests pass after each fix. TypeScript `noEmit` clean throughout.

---

## PaymentsModule — IDOR fix (CRÍTICO)

**File:** `apps/api/src/modules/payments/presentation/controllers/order-refund.controller.ts`
- Added `@UseGuards(ActorGuard, OrganizationRoleGuard)` at class level
- Added `@RequireCapability(OrganizationCapability.PAYOUT_REQUEST)` at class level
- Any authenticated user could previously initiate a refund for any org's order

**File:** `apps/api/src/modules/payments/payments.module.ts`
- Added `OrganizationRoleGuard` provider
- Added `{ provide: ORGANIZATION_INVITATION_REPOSITORY, useClass: PrismaOrganizationInvitationRepository }`
- Required for `OrganizationRoleGuard` dependency resolution

---

## OrdersModule — cancelAdmin IDOR (ALTO)

**File:** `apps/api/src/modules/orders/presentation/controllers/order-cancellation.controller.ts`
- `cancelAdmin` endpoint only had `ActorGuard` — any authenticated user could cancel any org's orders
- Added `@UseGuards(ActorGuard, OrganizationRoleGuard)` and `@RequireCapability(OrganizationCapability.EVENTS_MANAGE)`
- OWNER and ADMIN roles can cancel orders (both have EVENTS_MANAGE)

**File:** `apps/api/src/modules/orders/orders.module.ts`
- Added `OrganizationRoleGuard` and `ORGANIZATION_INVITATION_REPOSITORY` providers

---

## Orders — requestHash missing idempotencyKey (CRÍTICO)

**File:** `apps/api/src/modules/orders/application/use-cases/create-order.use-case.ts`
- `requestHash` was `SHA256({ reservationId })` — missing `idempotencyKey`
- Two different idempotency keys with the same `reservationId` had identical `requestHash`, breaking conflict detection
- Fixed: `requestHash = SHA256({ reservationId, idempotencyKey })`

**File:** `apps/api/src/modules/orders/application/use-cases/create-order.use-case.spec.ts`
- Updated expected `requestHash` in the spec to match the new formula

---

## Orders — idempotency record before validation (CRÍTICO)

**File:** `apps/api/src/modules/orders/infrastructure/adapters/reservation-access.adapter.ts`
- `idempotencyRecord.create` was called BEFORE status validation (EXPIRED/CANCELLED/CONSUMED checks)
- If reservation was expired, the idempotency key would be written but the transaction would fail
- On retry, the client would get an idempotency conflict instead of the actual error
- Fixed: moved status validation BEFORE the idempotency write, and moved `findOrderByReservation` before idempotency write too

---

## Reservations — cancel() no FOR UPDATE retry (CRÍTICO)

**File:** `apps/api/src/modules/reservations/infrastructure/repositories/prisma-reservation.repository.ts`
- `cancel()` ran at Serializable isolation but had no retry on serialization failure
- Two concurrent cancels would: one succeed, one get 40001 (serialization failure) propagated as 500
- Fixed:
  - Added `cancelWithRetries()` with 3-attempt retry on serialization failure
  - Added `FOR UPDATE` on the reservation row lock inside the transaction
  - Changed isolation from `Serializable` to `RepeatableRead` (FOR UPDATE handles the locking)
  - Added explicit check: if `status === 'EXPIRED' || expires_at <= now` → return early (no inventory adjustment needed)

---

## FinanceController — ParseUUIDPipe and limit NaN (ALTO)

**File:** `apps/api/src/modules/finance/presentation/controllers/finance.controller.ts`
- All `@Param('orgId')` params now use `new ParseUUIDPipe({ version: '4' })`
- `limit` query param now validated: must be integer 1–200; throws `BadRequestException` otherwise
- `CreatePayoutBody.idempotencyKey` now uses `@IsUUID('4')` instead of `@IsString() @IsNotEmpty()`
- Added `ParseUUIDPipe` and `IsUUID` imports

---

## Tickets/Transfer — acceptAtomically TOCTOU (ALTO)

**File:** `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`
- `acceptAtomically` checked `status !== 'PENDING'` inside the transaction but did NOT re-verify `expires_at`
- Between use-case check (`isExpired()`) and DB operation, the transfer could expire
- Fixed: added `FOR UPDATE` on the transfer SELECT, and throws `TransferExpiredError` if `expires_at <= NOW()`
- Added `TransferExpiredError` import

---

## Inventory — initializeForEvent no transaction (ALTO)

**File:** `apps/api/src/modules/inventory/infrastructure/repositories/prisma-inventory.repository.ts`
- `initializeForEvent` inserted records one by one without a transaction
- Partial failure (second item fails) left the first item committed in an inconsistent state
- Fixed: wrapped the entire loop in `this.prisma.$transaction()`

---

## Events — N+1 credential revocation + cancelledAt wrong timestamp (ALTO)

**File:** `apps/api/src/modules/events/infrastructure/repositories/prisma-event-cancellation.repository.ts`
- **N+1 fix**: replaced the per-ticket `UPDATE ticket_credentials WHERE ticket_id = X` loop with a single join-based batch UPDATE:
  ```sql
  UPDATE ticket_credentials tc SET status = 'REVOKED', revoked_at = NOW()
  FROM tickets t WHERE t.id = tc.ticket_id AND t.order_id = orderId::uuid AND tc.status = 'ACTIVE'
  ```
- **cancelledAt fix**: `cancelledAt` was captured as `new Date()` AFTER the transaction committed, which could be slightly different from `NOW()` inside the transaction. Fixed: capture `cancelled_at` from the `RETURNING` clause of the event UPDATE inside the transaction.

---

## Identity — soft-deleted/suspended user can authenticate (MÉDIO)

**File:** `apps/api/src/modules/identity/application/use-cases/authenticate-with-password.use-case.ts`
- Authentication query didn't filter for `deletedAt: null` or `suspendedAt: null`
- A soft-deleted or suspended user could obtain a valid JWT
- Fixed: added `user: { deletedAt: null, suspendedAt: null }` filter to `identity.findFirst()`

---

## Remaining known issues (not yet fixed)

### Finance
- `record-chargeback.use-case.ts`: balance decremented as `available` without checking settlement state — by design per D10 (chargebacks always hit available), low priority
- `process-payout-webhook.use-case.ts`: terminal status check outside transaction — mitigated by dedup `ON CONFLICT DO NOTHING` inside each handler's transaction
- `settle-order.use-case.ts`: pending can go negative if balance < sellerNetAmount — MÉDIO
- `settlement.worker.ts`: drain-loop without `isRunning` flag — MÉDIO
- `reconciliation.worker.ts`: needs FOR UPDATE SKIP LOCKED inside transaction — MÉDIO

### Organizations
- Missing composite indexes on `organization_members` — schema migration needed
- Email not normalized on invitation creation — MÉDIO

### Identity
- Layer violation: 4 use cases inject `PrismaService` directly — architectural debt, ALTO
- Missing index `[ip, attemptedAt]` on `auth_attempts` — schema migration needed
- `emailVerificationRepository.create` outside transaction — MÉDIO
- `forceReset` flag never verified during login — MÉDIO

### Orders/Reservations
- Inventory underflow guards (missing `AND reserved >= quantity`) — ALTO
- Serialization failure `40P01` not retried in some paths — ALTO
- `total_amount` mismatch (always equals `subtotal_amount`) — MÉDIO
