# Relatório da TASK-031 — Payment Webhooks & Order Confirmation

## Status

MERGED em develop — 7 testes unitários + 9 testes de integração (incluindo concorrência), typecheck e build limpos.

## Migrations

- `apps/api/prisma/migrations/20260812000011_payment_webhook_events/migration.sql` — tabela `payment_webhook_events`:
  - `UNIQUE(provider, provider_event_id)` — deduplicação de webhooks.
- `apps/api/prisma/migrations/20260812000012_order_paid_status/migration.sql` — amplia `CHECK` constraint dos orders para incluir `PAID` e `TICKETS_ISSUED`.

## Arquivos criados/modificados

### Domínio (modificado)
- `modules/orders/domain/order.entity.ts` — `OrderStatus` ampliado: `'PENDING_PAYMENT' | 'PAID' | 'TICKETS_ISSUED' | 'CANCELLED' | 'EXPIRED'`.

### Aplicação
- `payments/application/use-cases/process-payment-webhook.use-case.ts` — fluxo completo:
  - `parseWebhook` valida assinatura HMAC.
  - `INSERT ... ON CONFLICT DO NOTHING` para deduplicação de webhook events.
  - Transação com `FOR UPDATE` em order e payment_attempt para prevenir processamento duplo.
  - Valida amount/currency antes de marcar PAID.
  - Atualiza inventory (`committed += qty, reserved -= qty`) atomicamente.
  - Insere 3 outbox events: `payment.approved.v1`, `order.paid.v1`, `inventory.committed.v1`.
  - Regressão de status prevenida: ignora APPROVED se order já PAID/TICKETS_ISSUED.
- `payments/application/use-cases/process-payment-webhook.use-case.spec.ts` — 7 testes unitários.

### Infraestrutura
- `payments/infrastructure/adapters/inventory-commit.adapter.ts` — SQL atômico para transição reserved→committed.
- `payments/infrastructure/repositories/prisma-webhook-event.repository.ts`.

### Apresentação
- `payments/presentation/controllers/payment-webhook.controller.ts` — `POST /api/v1/webhooks/payments/fake`:
  - Lê `rawBody` via Fastify (configurado com `rawBody: true` em `main.ts`).
  - Retorna 400 sem detalhes para `WebhookSignatureError`.

### App
- `apps/api/src/main.ts` — `rawBody: true` adicionado para preservar corpo bruto para validação HMAC.

### Testes de integração
- `test/integration/payments/payment-webhook.controller.integration-spec.ts` — 9 cenários: assinatura válida/inválida, APPROVED→PAID, DECLINED, idempotência, amount divergente, concorrência (2 webhooks simultâneos).

## Decisões

1. `rawBody: true` no Fastify sem dependência adicional — Fastify suporta nativamente.
2. `FOR UPDATE` na order + `ON CONFLICT DO NOTHING` no webhook_event garantem exatamente-uma-vez sem 2PC.
3. Amount divergente não marca PAID e registra `error_message` para reconciliação manual; responde 200 para não revelar motivo ao PSP.

## Testes

| Tipo | Total | Resultado |
|---|---|---|
| Unitários | 7 | ✅ |
| Integração | 9 (incl. 1 concorrência) | ✅ |
