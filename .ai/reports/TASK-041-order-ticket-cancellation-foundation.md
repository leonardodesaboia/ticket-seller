# Relatório da TASK-041 — Order & Ticket Cancellation Foundation

## Status

COMPLETED — aguardando merge em develop.

## Arquivos criados

### Migration
- `apps/api/prisma/migrations/20260813000018_order_ticket_cancellation/migration.sql`
  - `orders`: `cancelled_at TIMESTAMPTZ`, `cancellation_reason VARCHAR(255)`, `cancellation_source VARCHAR(30)`, CHECK constraint `orders_cancelled_consistency`, índice parcial `orders_cancelled_at_idx`.
  - `tickets`: `cancelled_at TIMESTAMPTZ`, CHECK constraint `tickets_cancelled_consistency`.

### Schema
- `apps/api/prisma/schema.prisma` — campos `cancelledAt`, `cancellationReason`, `cancellationSource` no model `Order`; `cancelledAt` no model `Ticket`.

### Domain
- `apps/api/src/modules/orders/domain/cancellation-policy.ts` — `evaluateCancellationEligibility` (função pura, sem IO); tipos `CancellationEligibilityCode`, `CancellationSource`, `CancellationContext`; `CANCELLABLE_STATUSES = ['PENDING_PAYMENT', 'TICKETS_ISSUED']`.
- `apps/api/src/modules/orders/domain/cancellation.errors.ts` — `OrderNotFoundForCancellationError`, `InvalidReservationTokenError`, `OrderNotCancellableError` (carrega `eligibilityCode`), `InsufficientRoleForCancellationError` (reservado para quando auth expor roles).

### Application port
- `apps/api/src/modules/orders/application/ports/order-cancellation-repository.port.ts` — `IOrderCancellationRepository` com 6 métodos, símbolo `ORDER_CANCELLATION_REPOSITORY`.

### Use case
- `apps/api/src/modules/orders/application/use-cases/cancel-order.use-case.ts`
  - `executeByToken` — comprador: valida token via hash em um único query, aceita apenas PENDING_PAYMENT, chama `cancelPrePaymentOrder`.
  - `executeByAdmin` — admin: verifica check-in ADMITTED e transfer PENDING em paralelo (`Promise.all`), roteia para `cancelPrePaymentOrder` (PENDING_PAYMENT) ou `cancelPostPaymentOrder` (TICKETS_ISSUED).
- `apps/api/src/modules/orders/application/use-cases/cancel-order.use-case.spec.ts` — 12 testes unitários (4 buyer + 8 admin).

### Repository
- `apps/api/src/modules/orders/infrastructure/repositories/prisma-order-cancellation.repository.ts`
  - `findForCancellationByToken` — SHA-256 do token, JOIN orders → reservations.
  - `cancelPrePaymentOrder` — transação: `SELECT FOR UPDATE`, cancelar payment_attempt PENDING, decrementar `reserved`, atualizar order, audit, outbox `order.cancelled.v1` (`requiresRefund: false`).
  - `cancelPostPaymentOrder` — transação: `SELECT FOR UPDATE`, UPDATE tickets RETURNING ids, REVOKE credentials, decrementar `committed`, atualizar order, audit, outbox `order.cancelled.v1` (`requiresRefund: true`) + `ticket.cancelled.v1` por ticket.

### Controller & DTOs
- `apps/api/src/modules/orders/presentation/controllers/order-cancellation.controller.ts`
  - `POST public/orders/:orderId/cancellations` — token via header `x-reservation-token`; 401 uniforme (não revela existência da order).
  - `POST organizations/:orgId/orders/:orderId/cancellations` — `ActorGuard` + `CurrentActor`.
- `apps/api/src/modules/orders/presentation/dto/cancel-order.request.ts` — DTOs públicos e admin com `reason?: string` opcional.

### Módulos atualizados
- `apps/api/src/modules/orders/infrastructure/orders.infrastructure.module.ts` — `PrismaOrderCancellationRepository` adicionado.
- `apps/api/src/modules/orders/orders.module.ts` — `CancelOrderUseCase`, `OrderCancellationController`, binding `ORDER_CANCELLATION_REPOSITORY`.

### Testes de integração
- `apps/api/test/integration/orders/cancel-order.integration-spec.ts` — 10 testes (Testcontainers):
  1. Cancela PENDING_PAYMENT: inventory released, outbox emitido.
  2. Token inválido → 401.
  3. Token ausente → 401.
  4. Idempotência: segundo cancel → 422 ORDER_ALREADY_CANCELLED.
  5. Admin cancela PENDING_PAYMENT.
  6. Admin cancela TICKETS_ISSUED: tickets CANCELLED, credentials REVOKED, committed released, outbox emitido.
  7. Order de outra org → 404.
  8. Check-in ADMITTED → 409 TICKET_ALREADY_USED.
  9. Transfer PENDING → 409 TICKET_TRANSFER_PENDING.
  10. Concorrência: dois cancelamentos simultâneos → 200 + 422, exatamente um outbox.

## Implementado

- Cancelamento pré-pagamento (comprador via token, admin).
- Cancelamento pós-pagamento (admin apenas): tickets CANCELLED, credentials REVOKED.
- Liberação de estoque: `reserved` (pré) ou `committed` (pós).
- Outbox transacional: `order.cancelled.v1`, `ticket.cancelled.v1`.
- Auditoria em `audit_entries` para operações admin.
- Idempotência via `SELECT FOR UPDATE` + re-check de status.
- Domínio puro: `evaluateCancellationEligibility` sem IO.
- Token do comprador validado por SHA-256 em um único query JOIN.

## Não implementado (fora do escopo)

- Refund / PSP call (TASK-042)
- Chargeback / dispute (TASK-044)
- Notificações (TASK-046)
- Event cancellation batch (TASK-043)

## Validações executadas

- `pnpm prisma generate` — OK
- `pnpm --filter @ticket-seller/api typecheck` — OK (zero erros)
- `pnpm --filter @ticket-seller/api lint` — OK nos arquivos novos (5 erros pré-existentes em outros módulos)
- `pnpm --filter @ticket-seller/api test --testPathPattern=cancel-order` — 12/12 OK
