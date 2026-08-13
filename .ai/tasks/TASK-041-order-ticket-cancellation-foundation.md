# TASK-041 — Order & Ticket Cancellation Foundation

## Status

COMPLETED

## Objetivo

Implementar o fluxo de cancelamento de orders e tickets: cancelamento pré-pagamento por comprador (via token) e pós-pagamento por admin, com liberação de estoque, auditoria e outbox — sem refund, sem PSP call.

## Resultado observável

- `POST /api/v1/public/orders/:orderId/cancellations` cancela order PENDING_PAYMENT autenticada por token de reserva (hex64); não exige `X-Organization-Id`.
- `POST /api/v1/organizations/:orgId/orders/:orderId/cancellations` cancela order PENDING_PAYMENT ou TICKETS_ISSUED via admin (ActorGuard).
- Cancelamento pré-pagamento: `reserved` decrementado, payment_attempt PENDING cancelado, outbox `order.cancelled.v1` com `requiresRefund: false`.
- Cancelamento pós-pagamento: tickets → CANCELLED, credentials → REVOKED, `committed` decrementado, outbox `order.cancelled.v1` (requiresRefund: true) + `ticket.cancelled.v1` por ticket.
- Check-in `ADMITTED` → 409 `TICKET_ALREADY_USED`.
- Transfer `PENDING` → 409 `TICKET_TRANSFER_PENDING`.
- Idempotência: segundo cancelamento → 422 `ORDER_ALREADY_CANCELLED`.
- `SELECT ... FOR UPDATE` garante atomicidade sob concorrência.
- Auditoria em `audit_entries` para operações admin.

## Contexto obrigatório

- `AGENTS.md`
- `.ai/tasks/TASK-041-order-ticket-cancellation-foundation.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/orders/`
- Padrão de token: `crypto.createHash('sha256').update(token).digest('hex')`, plaintext nunca armazenado.

## Fora do escopo

❌ Refund / PSP call
❌ Chargeback / dispute
❌ Notificações
❌ Event cancellation batch
❌ Cancelamento de transferência

## Arquivos permitidos

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260813000018_order_ticket_cancellation/`
- `apps/api/src/modules/orders/domain/cancellation-policy.ts`
- `apps/api/src/modules/orders/domain/cancellation.errors.ts`
- `apps/api/src/modules/orders/application/ports/order-cancellation-repository.port.ts`
- `apps/api/src/modules/orders/application/use-cases/cancel-order.use-case.ts`
- `apps/api/src/modules/orders/application/use-cases/cancel-order.use-case.spec.ts`
- `apps/api/src/modules/orders/infrastructure/repositories/prisma-order-cancellation.repository.ts`
- `apps/api/src/modules/orders/infrastructure/orders.infrastructure.module.ts`
- `apps/api/src/modules/orders/presentation/controllers/order-cancellation.controller.ts`
- `apps/api/src/modules/orders/presentation/dto/cancel-order.request.ts`
- `apps/api/src/modules/orders/orders.module.ts`
- `apps/api/test/integration/orders/cancel-order.integration-spec.ts`

## Invariantes

- Cancelamento ≠ Refund (sem PSP call nesta task)
- Histórico nunca apagado — apenas mudança de status
- Idempotência obrigatória
- `SELECT ... FOR UPDATE` antes de qualquer mutação de estado
- `order.cancelled.v1` na mesma transação da mudança de estado
