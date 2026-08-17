# TASK-043 — Event Cancellation & Mass Refunds

## Status

DONE

## Dependências

TASK-041 (cancelamento foundation), TASK-042 (refund processing)

## Objetivo

Permitir ao admin cancelar um evento inteiro, cancelando todas as orders ativas e enfileirando reembolsos em massa via outbox/worker.

## Resultado observável

- `POST /api/v1/organizations/:orgId/events/:eventId/cancellations` (admin) cancela o evento.
- Todas as orders PENDING_PAYMENT e TICKETS_ISSUED do evento são canceladas em batch.
- Outbox emite `event.cancelled.v1` + `order.cancelled.v1` para cada order (em chunks de 100).
- Worker consome `event.cancelled.v1` e dispara refunds via TASK-042.
- Idempotente: evento já CANCELLED → 422.

## Fora do escopo

❌ Notificações por e-mail (TASK-046)
❌ Reembolso parcial
