# TASK-042 — Refund Processing

## Status

DONE

## Dependências

TASK-041 (cancelamento foundation)

## Objetivo

Processar reembolso via PSP após cancelamento de order pós-pagamento: chamar `PaymentGatewayPort.refund()`, persisir `refund_attempts`, emitir `order.refunded.v1`.

## Resultado observável

- Order com `requiresRefund: true` (outbox de TASK-041) aciona fluxo de refund.
- `POST /api/v1/organizations/:orgId/orders/:orderId/refunds` (admin) ou worker consome `order.cancelled.v1`.
- Tabela `refund_attempts` persiste tentativas com status `PENDING / SUCCESS / FAILED`.
- Refund idempotente: mesmo PSP externalId não duplica.
- Order transita de CANCELLED para REFUNDED (ou PARTIALLY_REFUNDED).
- Outbox: `order.refunded.v1` com `amount`, `currency`, `externalRefundId`.

## Fora do escopo

❌ Chargeback
❌ Notificações
❌ UI de refund
❌ Reembolso parcial (MVP: total only)
