# Relatório da TASK-044 — Chargebacks & Payment Disputes

## Status

COMPLETED — integrado em develop (2026-08-17).

## Arquivos criados

### Migration
- `apps/api/prisma/migrations/20260817000021_payment_disputes/migration.sql`
  - Expansão do `orders_status_check` para incluir `REFUNDED` e `CHARGEBACK` (correção de omissão da TASK-042).
  - Tabela `payment_disputes`: `id UUID`, `organization_id`, `order_id` (FK), `payment_attempt_id` (FK), `provider TEXT`, `external_dispute_id TEXT`, `status TEXT DEFAULT 'OPEN'`, `amount BIGINT`, `currency TEXT`, `raw_payload JSONB`.
  - Índice único: `UNIQUE(provider, external_dispute_id)` para idempotência.
  - Índices: `organization_id`, `order_id`.

### Domain
- `apps/api/src/modules/payments/domain/ports/payment-gateway.port.ts` — adicionado `'PAYMENT_DISPUTED'` ao tipo `PaymentWebhookEventType`.

### Application
- `apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts`
  - `ProcessChargebackInput`: `provider`, `providerEventId`, `externalPaymentId`, `amount`, `currency`.
  - `INSERT INTO payment_disputes ON CONFLICT DO NOTHING` — retorna 0 se já processado.
  - Busca order por `order_id` do attempt.
  - Valida status `PAID` ou `TICKETS_ISSUED` (ignora outros estados).
  - Em `$transaction` com `SELECT FOR UPDATE`: cancela tickets ACTIVE, revoga credentials, libera `committed` com `GREATEST(..., 0)`, atualiza order para `CHARGEBACK`, emite outbox `order.chargeback.v1`.
  - Atualiza `payment_disputes.status = 'PROCESSED'` após commit.
- `apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.spec.ts` — 8 testes unitários.
- `apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts` — delegação de `PAYMENT_DISPUTED` para `ProcessChargebackUseCase` injetado; `parseWebhook` usa `input.provider` (não literal hardcoded).

### Infrastructure
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.ts` — `parseWebhook` aceita `PAYMENT_DISPUTED` e mapeia para `status: 'APPROVED'` (compatível com tipagem existente).

### Testes de integração
- `apps/api/test/integration/payments/chargeback.integration-spec.ts` — 7 testes (Testcontainers):
  1. PAYMENT_DISPUTED em TICKETS_ISSUED → CHARGEBACK, tickets CANCELLED.
  2. Disputa persistida com status PROCESSED.
  3. Outbox `order.chargeback.v1` emitido.
  4. Committed inventory liberado.
  5. Webhook duplicado → idempotente (uma disputa, estado intocado).
  6. Webhook de outra org não afeta outras orgs.
  7. Assinatura inválida → 400.

## Implementado

- `ProcessChargebackUseCase` injetado em `ProcessPaymentWebhookUseCase`.
- Idempotência via `UNIQUE(provider, external_dispute_id)` + retorno de 0 rows.
- `SELECT FOR UPDATE` na transação principal.
- `GREATEST(committed - quantity, 0)` protege contra underflow de inventário.
- `provider` passado via input (não hardcoded) — arquitetura hexagonal respeitada.

## Não implementado (fora do escopo)

- UI de disputas.
- Integração com painel de contestação do PSP.
- Notificação ao admin (TASK-046).

## Correções pós-revisão

- `'FAKE'` removido da camada de aplicação; `provider` agora vem de `gateway.provider` via `ProcessChargebackInput` (I3 da revisão).
- `parseWebhook` atualizado para usar `input.provider` em vez de literal (I3).

## Validações executadas

- `prisma generate` — OK
- `tsc --noEmit` — OK
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
- `pnpm --filter @ticket-seller/api test:integration --testPathPattern=chargeback` — 7/7 OK
