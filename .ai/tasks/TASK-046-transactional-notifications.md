# TASK-046 — Transactional Notifications

## Status

DONE

## Dependências

TASK-045 (notification foundation), TASK-041 (cancelamento foundation), TASK-042 (refund), TASK-043 (event cancellation), TASK-044 (chargeback)

## Objetivo

Conectar todos os eventos de domínio de cancelamento, refund e chargeback ao sistema de notificações: e-mails transacionais para o comprador sobre cada mudança de estado relevante.

## Resultado observável

- `order.cancelled.v1` → e-mail "Seu pedido foi cancelado" ao comprador.
- `order.refunded.v1` → e-mail "Seu reembolso foi processado" com valor e prazo.
- `event.cancelled.v1` → e-mail "O evento foi cancelado" a todos os compradores.
- `order.chargeback.v1` → alerta interno para o admin (não ao comprador).
- Idempotência: `notification_log` impede duplicados por `(orderId, eventType)`.
- Testes de integração com provider mockado verificam conteúdo e destinatário corretos.

## Fora do escopo

❌ Templates HTML elaborados
❌ Provider real de e-mail
❌ Notificações em tempo real (WebSocket/SSE)
