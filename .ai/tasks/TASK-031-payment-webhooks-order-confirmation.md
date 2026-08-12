# TASK-031 — Payment Webhooks & Order Confirmation

## Status

DONE — MERGED em develop

## Objetivo

Implementar a confirmação assíncrona e oficial do pagamento via webhook. Um order só passa para `PAID` após webhook validado criptograficamente pelo servidor.

## Dependências

TASK-030 integrada em develop.

## Propriedade exclusiva

- `apps/api/src/modules/payments/` (evolução)
- `apps/api/src/modules/orders/domain/order.entity.ts` — adicionar status PAID e TICKETS_ISSUED
- `apps/api/src/modules/orders/domain/order.errors.ts` — novos erros de transição
- `apps/api/prisma/schema.prisma` — adicionar `PaymentWebhookEvent`, atualizar Order.status check
- `apps/api/prisma/migrations/20260812000011_payment_webhook_events/`
- `apps/api/prisma/migrations/20260812000012_order_paid_status/`

## Fora do escopo

Emissão de ticket (TASK-032), reembolso, chargeback.

## Modelagem

### payment_webhook_events

```sql
payment_webhook_events:
- id                  UUID PK
- provider            VARCHAR(50) NOT NULL        -- 'FAKE'
- provider_event_id   VARCHAR(255) NOT NULL       -- dedup key do PSP
- payment_attempt_id  UUID NULL FK → payment_attempts
- external_payment_id VARCHAR(255) NOT NULL
- event_type          VARCHAR(100) NOT NULL       -- PAYMENT_APPROVED etc.
- raw_status          VARCHAR(100) NOT NULL       -- status normalizado
- amount              BIGINT NULL
- currency            VARCHAR(3) NULL
- processed_at        TIMESTAMPTZ NULL
- failed_at           TIMESTAMPTZ NULL
- error_message       TEXT NULL
- created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

UNIQUE: (provider, provider_event_id)   -- deduplicação
INDEX: (external_payment_id)
INDEX: (payment_attempt_id)
INDEX: (processed_at)
```

### Order.status — novos valores

Adicionar migration para verificar/permitir PAID e TICKETS_ISSUED:
- CHECK constraint atual em SQL: `status IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')`
- Nova migration: `ALTER TABLE orders DROP CONSTRAINT ...; ALTER TABLE orders ADD CONSTRAINT ... CHECK (status IN ('PENDING_PAYMENT','PAID','TICKETS_ISSUED','CANCELLED','EXPIRED'))`

Também atualizar `order.entity.ts`:
```typescript
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'TICKETS_ISSUED' | 'CANCELLED' | 'EXPIRED';
```

## Endpoint do webhook

```
POST /api/v1/webhooks/payments/fake
Headers:
  X-Fake-Signature: sha256=<hex>
  Content-Type: application/json

Body (raw JSON):
{
  "eventId": "string",
  "externalPaymentId": "string",
  "eventType": "PAYMENT_APPROVED" | "PAYMENT_DECLINED" | "PAYMENT_CANCELLED" | "PAYMENT_EXPIRED",
  "amount": 10000,
  "currency": "BRL"
}

Response 200: {}
Response 400: assinatura inválida ou body malformado (sem detalhar o motivo — segurança)
```

## Módulo — novos arquivos

```
payments/
  application/
    use-cases/
      process-payment-webhook.use-case.ts
    ports/
      inventory-commit.port.ts    — reservado→committed por order item
  infrastructure/
    adapters/
      inventory-commit.adapter.ts
    repositories/
      prisma-webhook-event.repository.ts
  presentation/
    controllers/
      payment-webhook.controller.ts
    dto/
      (raw body via @RawBody() ou middleware)
```

## Fluxo completo do webhook (APPROVED)

```
POST /api/v1/webhooks/payments/fake
→ preservar rawBody (NestJS/Fastify)
→ validar assinatura HMAC (FakeGateway.parseWebhook)
→ lançar 400 se inválida (sem detalhes)
→ INSERT payment_webhook_events (ON CONFLICT DO NOTHING — dedup)
→ se já processado: retornar 200 imediatamente
→ BEGIN TRANSACTION SERIALIZABLE
  → SELECT payment_attempt FOR UPDATE (por external_payment_id)
  → validar amount e currency (se divergente: falhar, nunca marcar como PAID)
  → UPDATE payment_attempts SET status = APPROVED
  → SELECT order FOR UPDATE
  → validar que order está PENDING_PAYMENT (idempotência: se já PAID retornar sucesso)
  → UPDATE orders SET status = 'PAID'
  → UPDATE ticket_inventory SET committed = committed + qty, reserved = reserved - qty
     para cada item do order (SQL atômico)
  → Outbox: payment.approved.v1, order.paid.v1, inventory.committed.v1
  → UPDATE payment_webhook_events SET processed_at = NOW()
COMMIT
→ 200 {}
```

**Nota sobre raw body:** Fastify descarta o body antes de chegar ao handler se não configurado. Registrar plugin `addContentTypeParser` para `application/json` que preserva o raw buffer.

## Fluxo para DECLINED / CANCELLED / EXPIRED

```
→ UPDATE payment_attempts SET status = (DECLINED|CANCELLED|EXPIRED)
→ NÃO alterar order
→ UPDATE payment_webhook_events SET processed_at = NOW()
→ Outbox: payment.declined.v1 | payment.cancelled.v1
→ 200 {}
```

## Máquina de estados: payment_attempt

```
PENDING → PROCESSING (opcional, se PSP enviar evento intermediário)
PENDING → APPROVED
PENDING → DECLINED
PENDING → CANCELLED
PENDING → EXPIRED
PROCESSING → APPROVED
PROCESSING → DECLINED
Qualquer → ignorar regressão (PENDING chega depois de APPROVED → ignorar)
```

## Máquina de estados: order

```
PENDING_PAYMENT → PAID (somente via webhook APPROVED validado)
PAID → TICKETS_ISSUED (TASK-032)
PENDING_PAYMENT → CANCELLED
PENDING_PAYMENT → EXPIRED
```

Não regredir: se order já PAID e chega segundo APPROVED → retornar 200 sem duplicar efeitos.

## Cenários de corrida obrigatórios (testar com PostgreSQL real)

### Cenário A — dois webhooks APPROVED simultâneos
```
resultado esperado:
  payment_attempt: APPROVED (uma vez)
  order: PAID (uma vez)
  inventory: committed incrementado uma vez
```
Garantido por: `FOR UPDATE` + `ON CONFLICT DO NOTHING` em webhook_events.

### Cenário B — reservation expirou × webhook APPROVED chega
```
resultado esperado:
  se order PENDING_PAYMENT → PAID (webhook vence — PSP confirmou)
  reservation já está CONSUMED — não interfere
  inventory committed uma vez
```
Reservation CONSUMED ao criar order (TASK-027) — não há conflito.

### Cenário C — amount divergente
```
webhook informa amount diferente de payment_attempt.amount
→ NÃO marcar PAID
→ registrar event com error_message
→ retornar 200 (não revelar ao PSP o motivo)
→ gerar log de alerta para reconciliação manual
```

## Segurança

- Sempre comparar assinatura com `crypto.timingSafeEqual`
- Nunca logar rawBody completo nem a assinatura
- Nunca expor stack trace no response
- Nunca confiar apenas em `externalPaymentId` + `status` sem assinatura
- Endpoint sem autenticação de usuário; autenticação é a assinatura do webhook

## Testes obrigatórios

### Unitários
- parseWebhook: assinatura válida → ParsedPaymentWebhook
- parseWebhook: assinatura inválida → WebhookSignatureError
- process-payment-webhook: APPROVED com amount correto → order PAID
- process-payment-webhook: APPROVED com amount divergente → order não PAID

### Integração (PostgreSQL real)
- assinatura válida → 200
- assinatura inválida → 400
- APPROVED → order PAID, inventory committed, attempt APPROVED, outbox emitido
- DECLINED → attempt DECLINED, order permanece PENDING_PAYMENT
- webhook duplicado (mesmo eventId) → 200 idempotente, sem duplicar efeitos
- amount divergente → order permanece PENDING_PAYMENT, log de alerta
- order já PAID → 200 idempotente
- webhook de order inexistente → 200 (não revelar existência)

### Concorrência (PostgreSQL real)
- 2 webhooks APPROVED simultâneos → order PAID uma vez, inventory committed uma vez
- webhook APPROVED + cancelamento concorrente → resultado determinístico

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```
