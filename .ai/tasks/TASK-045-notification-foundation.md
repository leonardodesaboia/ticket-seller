# TASK-045 — Notification Foundation

## Status

PLANNED

## Dependências

TASK-041 (para ter eventos de domínio a consumir)

## Objetivo

Implementar o módulo de notificações: provider de e-mail (Mailpit em dev, SES/SMTP em prod via adapter), templates mínimos, worker que consome eventos do outbox e despacha e-mails.

## Resultado observável

- `NotificationModule` com `IEmailProvider` port e `MailpitEmailAdapter` (dev).
- `SendEmailUseCase` com template simples (text/html via `handlebars` ou string interpolation).
- Worker `OutboxNotificationWorker` que polling `outbox_events` (status PENDING) e despacha.
- E-mail de confirmação de order enviado após `order.paid.v1` (TASK-027 event).
- Teste de integração: mock do provider confirma envio correto.

## Fora do escopo

❌ Push notifications
❌ SMS
❌ Provider real de e-mail (apenas adapter)
❌ Templates HTML elaborados (só texto formatado no MVP)
