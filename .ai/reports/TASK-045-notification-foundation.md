# Relatório da TASK-045 — Notification Foundation

## Status

COMPLETED — integrado em develop (2026-08-17).

## Arquivos criados

### Migration
- `apps/api/prisma/migrations/20260817000022_notification_log/migration.sql`
  - Tabela `notification_log`: `id UUID`, `organization_id UUID`, `order_id UUID`, `event_type TEXT NOT NULL`, `recipient_email TEXT NOT NULL`, `sent_at TIMESTAMPTZ DEFAULT NOW()`, `outbox_event_id UUID` (FK `outbox_events`).
  - Índice único parcial: `UNIQUE(order_id, event_type) WHERE order_id IS NOT NULL`.

### Domain
- `apps/api/src/modules/notifications/domain/ports/email-provider.port.ts` — `IEmailProvider` com `send({ to, subject, text })`, token `EMAIL_PROVIDER`.
- `apps/api/src/modules/notifications/domain/ports/notification-log-repository.port.ts` — `INotificationLogRepository` com `hasBeenSent(orderId, eventType)`, `hasBeenSentForOutboxEvent(outboxEventId)`, `record(entry)`; token `NOTIFICATION_LOG_REPOSITORY`.
- `apps/api/src/modules/notifications/domain/notification.errors.ts` — erros de domínio do módulo.

### Application
- `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.ts`
  - Idempotência em dois níveis: `orderId` → `hasBeenSent()`; sem `orderId` mas com `outboxEventId` → `hasBeenSentForOutboxEvent()`.
  - Chama `emailProvider.send()`.
  - Grava `notification_log` com `ON CONFLICT DO NOTHING`.
- `apps/api/src/modules/notifications/application/use-cases/send-email.use-case.spec.ts` — 5 testes unitários.

### Infrastructure — adapters
- `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.ts`
  - `nodemailer` com transporte SMTP.
  - Lê `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` do env (validado por Zod em `apps/api/src/platform/config/env.ts`).
- `apps/api/src/modules/notifications/infrastructure/adapters/mailpit-email.adapter.spec.ts` — 3 testes unitários.

### Infrastructure — repositories
- `apps/api/src/modules/notifications/infrastructure/repositories/prisma-notification-log.repository.ts`
  - `hasBeenSent()`: SELECT por `order_id + event_type`.
  - `hasBeenSentForOutboxEvent()`: SELECT por `outbox_event_id`.
  - `record()`: INSERT `ON CONFLICT DO NOTHING`.

### Infrastructure — workers
- `apps/api/src/modules/notifications/infrastructure/workers/outbox-notification.worker.ts`
  - Polling a cada 5 segundos (`setInterval`).
  - Consulta `outbox_events WHERE type = ANY([handled_types]) AND processed_at IS NULL AND failed_at IS NULL LIMIT 10`.
  - `OnModuleInit` / `OnModuleDestroy` para ciclo de vida.
  - Handler inicial: `order.paid.v1` → email de confirmação de pedido.

### Módulos
- `apps/api/src/modules/notifications/notifications.module.ts` — providers: `SendEmailUseCase`, `OutboxNotificationWorker`; imports: `NotificationsInfrastructureModule`.
- `apps/api/src/modules/notifications/infrastructure/notifications.infrastructure.module.ts` — providers: `MailpitEmailAdapter`, `PrismaNotificationLogRepository`, tokens `EMAIL_PROVIDER`, `NOTIFICATION_LOG_REPOSITORY`.

### Config
- `apps/api/src/platform/config/env.ts` — adicionado `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` ao schema Zod.

## Implementado

- Infraestrutura de email com SMTP via `nodemailer` (Mailpit em dev).
- `notification_log` para rastreamento e deduplicação de notificações.
- `SendEmailUseCase` com idempotência dupla (order-level e outbox-event-level).
- Worker de polling com lifecycle NestJS.
- `order.paid.v1` → email de confirmação ao comprador (email placeholder: `comprador@ticket-seller.local`).

## Não implementado (fora do escopo)

- Templates HTML elaborados.
- Provider real de email (ex: SendGrid, SES).
- Notificações em tempo real (WebSocket/SSE).
- Eventos além de `order.paid.v1` (TASK-046).

## Limitações documentadas

- Não há `buyer_email` nem `user_id` no modelo `Order` — usa email placeholder.
- Worker não tem retry para `failed_at` (dead-letter queue é dívida técnica).
- Worker sem `SELECT FOR UPDATE SKIP LOCKED` — seguro apenas para instância única.

## Correções pós-revisão

- `UNIQUE INDEX notification_log_outbox_event_id ON notification_log (outbox_event_id) WHERE outbox_event_id IS NOT NULL` adicionado via migration `20260817000023` (C1 da revisão).

## Validações executadas

- `prisma generate` — OK
- `tsc --noEmit` — OK
- `pnpm --filter @ticket-seller/api test` — 293/293 OK
