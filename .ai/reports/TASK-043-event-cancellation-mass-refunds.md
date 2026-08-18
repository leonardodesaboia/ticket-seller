# Relatório da TASK-043 — Event Cancellation & Mass Refunds

## Status

COMPLETED — integrado em develop (2026-08-17).

## Arquivos criados

### Migration
- `apps/api/prisma/migrations/20260817000020_event_cancellation/migration.sql`
  - `events`: colunas `cancelled_at TIMESTAMPTZ`, `cancellation_reason TEXT`.

### Domain
- `apps/api/src/modules/events/domain/event-cancellation.errors.ts` — `EventNotFoundError`, `EventNotCancellableError` (carrega `code`: `EVENT_ALREADY_CANCELLED` | `EVENT_IN_NON_CANCELLABLE_STATE`).

### Application port
- `apps/api/src/modules/events/application/ports/event-cancellation-repository.port.ts` — `IEventCancellationRepository` com `getEventStatus()` e `cancelEvent()`; `CancelEventParams`, `CancelEventResult`.

### Use case
- `apps/api/src/modules/events/application/use-cases/cancel-event.use-case.ts`
  - Verifica existência do evento na org.
  - Valida status não `CANCELLED` (422) e não em estado inválido (422).
  - Delega para `repo.cancelEvent()`.
- `apps/api/src/modules/events/application/use-cases/cancel-event.use-case.spec.ts` — 6 testes unitários.

### Repository (infraestrutura)
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event-cancellation.repository.ts`
  - `cancelEvent()`: dentro de `$transaction`:
    - `UPDATE events SET status='CANCELLED' RETURNING id` (guarda idempotência sob lock).
    - Loop de chunks (`FOR UPDATE SKIP LOCKED`, `LIMIT 100`, sem OFFSET — padrão correto para mutação em lote).
    - `PENDING_PAYMENT`: cancela payment_attempts, libera `reserved`, outbox `order.cancelled.v1` (`requiresRefund: false`).
    - `PAID`: libera `reserved` com `GREATEST(..., 0)`, outbox `order.cancelled.v1` (`requiresRefund: true`). *(adicionado na revisão)*
    - `TICKETS_ISSUED`: cancela tickets, revoga credentials, libera `committed`, outbox `order.cancelled.v1` (`requiresRefund: true`) + `ticket.cancelled.v1` por ticket.
    - Outbox `event.cancelled.v1` com `ordersCancelledCount`.
    - Audit entry se `actorId` fornecido.

### Presentation
- `apps/api/src/modules/events/presentation/controllers/event-cancellation.controller.ts`
  - `POST /api/v1/organizations/:orgId/events/:eventId/cancellations`
  - HTTP 200 com `{ eventId, status, cancelledAt, ordersCancelledCount }`. Usa `ActorGuard`.

### Módulos atualizados
- `apps/api/src/modules/events/infrastructure/events.infrastructure.module.ts` — `PrismaEventCancellationRepository` adicionado.
- `apps/api/src/modules/events/events.module.ts` — `CancelEventUseCase`, `EventCancellationController`, binding `EVENT_CANCELLATION_REPOSITORY`.

### Testes de integração
- `apps/api/test/integration/events/event-cancellation.integration-spec.ts` — 11 testes (Testcontainers):
  1. Cancela evento PUBLISHED — shape correto.
  2. Status do evento vira CANCELLED no banco.
  3. Cancela com orders TICKETS_ISSUED — requiresRefund=true, outbox emitido.
  4. Cancela com orders PENDING_PAYMENT — requiresRefund=false, inventário liberado.
  5. Idempotência: segundo cancelamento → 422 EVENT_ALREADY_CANCELLED.
  6. Evento inexistente → 404.
  7. Evento de outra org → 404.
  8. `event.cancelled.v1` outbox emitido.
  9. Audit entry criada com actorId.
  10. Sem orders — `ordersCancelledCount` é 0.
  11. Cancela com order em status PAID — requiresRefund=true, inventário reserved liberado. *(adicionado na revisão)*

## Implementado

- Cancelamento de evento publicado ou rascunho.
- Cancelamento em lote de orders associadas (PENDING_PAYMENT, PAID, TICKETS_ISSUED).
- Paginação segura sem OFFSET (drain-the-queue com `FOR UPDATE SKIP LOCKED`).
- Outbox transacional por order + por ticket + por evento.
- Auditoria em `audit_entries`.
- Multi-tenancy: todas as queries filtram por `organization_id`.

## Não implementado (fora do escopo)

- Reembolso imediato via PSP (aciona TASK-042 via outbox `requiresRefund: true`).
- Notificações (TASK-046).
- UI de cancelamento de evento.

## Correções pós-revisão

- Adicionado tratamento de orders com status `PAID` (C2 da revisão).
- Removido `OFFSET` e adicionado `SKIP LOCKED` na paginação em lote (I4 da revisão).
- Teste 11 adicionado para cobrir o cenário PAID.

## Validações executadas

- `prisma generate` — OK
- `tsc --noEmit` — OK
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
- `pnpm --filter @ticket-seller/api test:integration --testPathPattern=event-cancellation` — 11/11 OK
