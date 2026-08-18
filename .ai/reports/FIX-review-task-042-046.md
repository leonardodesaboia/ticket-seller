# Relatório do Fix — Revisão TASK-042 a TASK-046

## Status

COMPLETED — integrado em develop (2026-08-17, commit 47082fa).

## Contexto

Revisão de código conduzida após integração das TASK-042 a TASK-046. Identificados 2 problemas críticos, 2 importantes e 3 menores. Críticos e importantes corrigidos neste fix.

## Problemas corrigidos

### C1 — Índice único ausente em `notification_log.outbox_event_id` (CRÍTICO)

**Arquivo:** `apps/api/prisma/migrations/20260817000023_notification_log_outbox_dedup/migration.sql`

**Problema:** `ON CONFLICT DO NOTHING` no `PrismaNotificationLogRepository.record()` não ativava nenhum conflito para eventos sem `orderId` (`event.cancelled.v1`). O índice parcial existente `UNIQUE(order_id, event_type) WHERE order_id IS NOT NULL` não se aplica quando `order_id` é `NULL`. Em múltiplas instâncias do worker, emails duplicados seriam enviados.

**Correção:**
```sql
CREATE UNIQUE INDEX notification_log_outbox_event_id
  ON notification_log (outbox_event_id)
  WHERE outbox_event_id IS NOT NULL;
```

---

### C2 — Orders com status `PAID` ignoradas no cancelamento de evento (CRÍTICO)

**Arquivo:** `apps/api/src/modules/events/infrastructure/repositories/prisma-event-cancellation.repository.ts`

**Problema:** A query de cancelamento em lote filtrava apenas `PENDING_PAYMENT` e `TICKETS_ISSUED`. Um pedido no estado `PAID` (pagamento confirmado, ingressos ainda não emitidos — janela entre webhook e issuance) ficaria preso indefinidamente sem cancelamento nem reembolso.

**Correção:** Adicionado `'PAID'` ao filtro com tratamento específico: libera `reserved` com `GREATEST(..., 0)`, cancela order, emite `order.cancelled.v1` com `requiresRefund: true`.

---

### I4 — Paginação `LIMIT + OFFSET` instável após mutação (IMPORTANTE)

**Arquivo:** `apps/api/src/modules/events/infrastructure/repositories/prisma-event-cancellation.repository.ts`

**Problema:** O loop avançava `OFFSET` em `CHUNK_SIZE` após cada iteração. Como os registros processados eram atualizados para `CANCELLED` (excluídos da próxima query), o conjunto efetivo encolhia. O OFFSET então pulava registros não processados — bug de corretude em cancelamentos com mais de 100 pedidos.

**Correção:** Removido `OFFSET`. O loop sempre busca os primeiros `CHUNK_SIZE` registros elegíveis. Após cada iteração, os processados saem do filtro naturalmente. Adicionado `FOR UPDATE SKIP LOCKED` para segurança em múltiplas instâncias.

---

### I3 — Provider `'FAKE'` hardcoded na camada de aplicação (IMPORTANTE)

**Arquivo:** `apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts`

**Problema:** `'FAKE'` estava hardcoded na camada de aplicação para INSERT e UPDATE em `payment_disputes`. A application layer não deve conhecer nomes de providers (detalhe de infraestrutura — viola arquitetura hexagonal).

**Correção:** Adicionado `provider: string` a `ProcessChargebackInput`. `ProcessPaymentWebhookUseCase` passa `this.gateway.provider` ao delegar. `parseWebhook()` atualizado para usar `input.provider`.

---

## Problemas não corrigidos (MVP — dívida técnica)

| ID | Severidade | Motivo de não corrigir |
|----|-----------|------------------------|
| I1 | IMPORTANTE | Worker usa `setInterval` sem `FOR UPDATE SKIP LOCKED` — safe para single-instance MVP |
| I2 | IMPORTANTE | `Number(bigint)` no outbox payload — valores reais abaixo de `MAX_SAFE_INTEGER` |
| I5 | IMPORTANTE | Sem retry para `failed_at` — dead-letter queue é tarefa futura |
| m1 | MENOR | Sem CHECK constraint em `refund_attempts.status` / `payment_disputes.status` |
| m2 | MENOR | `ProcessRefundResult.refundedAmount: number` em vez de `bigint` |
| m3 | MENOR | DTO inline no controller de event cancellation |

## Arquivos modificados

- `apps/api/prisma/migrations/20260817000023_notification_log_outbox_dedup/migration.sql` *(novo)*
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event-cancellation.repository.ts`
- `apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts`
- `apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.spec.ts`
- `apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts`
- `apps/api/test/integration/events/event-cancellation.integration-spec.ts` *(teste 11 adicionado)*

## Validações executadas

- `tsc --noEmit` — OK
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
- `pnpm --filter @ticket-seller/api test:integration --testPathPattern=event-cancellation|chargeback|outbox-notification` — 25/25 OK
