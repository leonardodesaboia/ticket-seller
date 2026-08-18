# Relatório da TASK-046 — Transactional Notifications

## Status

COMPLETED — integrado em develop (2026-08-17).

## Arquivos modificados

### Domain
- `apps/api/src/modules/notifications/domain/ports/notification-log-repository.port.ts`
  - Adicionado `hasBeenSentForOutboxEvent(outboxEventId: string): Promise<boolean>` à interface.

### Application
- `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.ts`
  - Adicionado path de idempotência por `outboxEventId`: quando `orderId` é ausente mas `outboxEventId` está presente, verifica `hasBeenSentForOutboxEvent()` antes de enviar.
- `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.spec.ts`
  - 5 testes (atualizado): cobre order-level deduplication, outbox-event-level deduplication (skip quando já enviado), envio correto quando outbox-level retorna false, e envio sem verificação quando nenhum ID presente.

### Infrastructure — repositories
- `apps/api/src/modules/notifications/infrastructure/repositories/prisma-notification-log.repository.ts`
  - Implementado `hasBeenSentForOutboxEvent()`: `SELECT id FROM notification_log WHERE outbox_event_id = $1::uuid LIMIT 1`.

### Infrastructure — workers
- `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
  - `HANDLED_TYPES` expandido: `order.paid.v1`, `order.cancelled.v1`, `order.refunded.v1`, `event.cancelled.v1`, `order.chargeback.v1`.
  - `processEvent()` refatorado para `switch/case`.
  - Novos handlers:
    - `order.cancelled.v1` → `comprador@ticket-seller.local`, assunto "Seu pedido foi cancelado", inclui motivo se presente.
    - `order.refunded.v1` → `comprador@ticket-seller.local`, assunto "Seu reembolso foi processado", formata valor `amount / 100` em BRL.
    - `event.cancelled.v1` → `backoffice@ticket-seller.local` (alerta admin), assunto "Evento cancelado — alerta administrativo", inclui `ordersCancelledCount`. Idempotência via `outboxEventId` (sem `orderId`).
    - `order.chargeback.v1` → `backoffice@ticket-seller.local` (alerta admin, não ao comprador), inclui `externalDisputeId`.

### Testes de integração
- `apps/api/test/integration/notifications/outbox-notification.worker.integration-spec.ts` — 7 testes (Testcontainers):
  1. `order.cancelled.v1` → email enviado, log gravado.
  2. `order.refunded.v1` → email enviado com valor formatado "50.00 BRL".
  3. `event.cancelled.v1` → email admin, `order_id IS NULL`, `outbox_event_id` gravado.
  4. `order.chargeback.v1` → email para `backoffice@ticket-seller.local`, `externalDisputeId` no corpo.
  5. Idempotência `order.cancelled.v1`: segunda entrega não re-envia (notification_log impede).
  6. Idempotência `event.cancelled.v1`: segunda entrega não re-envia (via outboxEventId).
  7. Multi-event poll: dois eventos processados em único ciclo.

## Implementado

- Quatro novos handlers de eventos no worker com destinatários e mensagens corretos.
- Emails ao comprador: `order.cancelled.v1`, `order.refunded.v1`.
- Alertas admin: `event.cancelled.v1`, `order.chargeback.v1`.
- Idempotência dupla: `(order_id, event_type)` para eventos com orderId; `outbox_event_id` para eventos sem orderId.
- Email provider substituível via DI (testes usam mock).

## Não implementado (fora do escopo)

- Templates HTML elaborados.
- Provider real de email.
- Notificações em tempo real.
- Buyer email real (usa placeholder `comprador@ticket-seller.local`).

## Limitações documentadas

- `order.refunded.v1` serializa `amount` como `Number()` no outbox (bigint → number). Aceitável no MVP; valores práticos ficam abaixo de `Number.MAX_SAFE_INTEGER`.
- Worker não tem retry para eventos com `failed_at` (dead-letter queue é dívida técnica futura).

## Validações executadas

- `prisma generate` — OK
- `tsc --noEmit` — OK
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
- `pnpm --filter @ticket-seller/api test:integration --testPathPattern=outbox-notification` — 7/7 OK
