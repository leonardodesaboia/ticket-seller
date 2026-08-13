# TASK-044 — Chargebacks & Payment Disputes

## Status

PLANNED

## Dependências

TASK-041 (cancelamento foundation), TASK-042 (refund processing)

## Objetivo

Receber notificações de chargeback via webhook do PSP, registrar o dispute, cancelar tickets associados e marcar a order como CHARGEBACK.

## Resultado observável

- Webhook `PAYMENT_DISPUTED` recebido do PSP → persiste `payment_disputes` com status `OPEN`.
- Order transita para CHARGEBACK (se PAID/TICKETS_ISSUED).
- Tickets associados cancelados (mesmo fluxo de TASK-041 cancelamento pós-pagamento).
- Outbox `order.chargeback.v1`.
- Idempotente por `externalDisputeId`.

## Fora do escopo

❌ Resolução de dispute (vence o produtor)
❌ Notificações por e-mail (TASK-046)
