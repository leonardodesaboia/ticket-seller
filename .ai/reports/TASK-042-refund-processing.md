# Relatório da TASK-042 — Refund Processing

## Status

COMPLETED — integrado em develop (2026-08-17).

## Arquivos criados

### Migration
- `apps/api/prisma/migrations/20260817000019_refund_attempts/migration.sql`
  - Tabela `refund_attempts`: `id UUID`, `organization_id`, `order_id` (FK orders), `payment_attempt_id` (FK payment_attempts), `idempotency_key TEXT`, `external_refund_id TEXT`, `amount BIGINT`, `currency TEXT`, `status TEXT DEFAULT 'PENDING'`, `error_message TEXT`.
  - Índice único: `UNIQUE(order_id, idempotency_key)`.

### Domain
- `apps/api/src/modules/payments/domain/refund.errors.ts` — `OrderNotFoundForRefundError`, `OrderNotRefundableError` (carrega `code`), `RefundGatewayError`.
- `apps/api/src/modules/payments/domain/ports/payment-gateway.port.ts` — adicionado `RefundPaymentInput`, `RefundPaymentResult` e método `refund()` ao `PaymentGatewayPort`.

### Application
- `apps/api/src/modules/payments/application/use-cases/process-refund.use-case.ts`
  - Busca order por `orgId + orderId`, valida status `CANCELLED`.
  - Busca `payment_attempt` com status `APPROVED`.
  - Gera `idempotency_key` determinístico: `SHA-256('refund:' + orderId)`.
  - `INSERT INTO refund_attempts ON CONFLICT DO UPDATE SET updated_at = updated_at` — retorna existente.
  - Retorna early se `status = 'SUCCESS'` (idempotência).
  - Chama `gateway.refund()`, trata `FAILED`.
  - Em `$transaction`: `SELECT FOR UPDATE` na order, atualiza para `REFUNDED`, emite outbox `order.refunded.v1` com `amount`, `currency`, `externalRefundId`.
- `apps/api/src/modules/payments/application/use-cases/process-refund.use-case.spec.ts` — 8 testes unitários.

### Infrastructure
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.ts` — implementado `refund()` com `externalRefundId = 'fake_refund_' + SHA-256(idempotencyKey).slice(0, 24)`.

### Presentation
- `apps/api/src/modules/payments/presentation/controllers/order-refund.controller.ts`
  - `POST /api/v1/organizations/:orgId/orders/:orderId/refunds`
  - HTTP 200 em sucesso. Usa `ActorGuard` + `CurrentActor`.

### Testes de integração
- `apps/api/test/integration/payments/order-refund.controller.integration-spec.ts` — 4 testes (Testcontainers):
  1. Refund de order CANCELLED com payment APPROVED → 200, order REFUNDED.
  2. Order não encontrada → 404.
  3. Order não CANCELLED → 422.
  4. Concorrência: dois refunds simultâneos → um sucesso, idempotência garante exatamente um refund.

## Implementado

- Endpoint admin `POST .../refunds` com validação de status e multi-tenancy.
- Idempotência via `UNIQUE(order_id, idempotency_key)` + retorno do estado existente.
- Chave idempotente determinística por SHA-256.
- `SELECT FOR UPDATE` no commit da transação.
- Outbox `order.refunded.v1` com valor, moeda e ID externo.
- `refund()` no `PaymentGatewayPort` e `FakePaymentGateway`.

## Não implementado (fora do escopo)

- Reembolso parcial (MVP: total apenas).
- Notificações (TASK-046).
- UI de reembolso.
- Chargeback / dispute.

## Correções pós-revisão

- `ProcessRefundUseCase`: `amount` serializado como `Number()` no outbox (bigint → number) — identificado como IMPORTANTE pelo revisor; mantido no MVP pois valores práticos ficam abaixo de `Number.MAX_SAFE_INTEGER`.

## Validações executadas

- `prisma generate` — OK
- `tsc --noEmit` — OK (zero erros)
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
