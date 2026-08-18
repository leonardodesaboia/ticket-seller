ADR-006 — Notificações transacionais via worker de polling do outbox com deduplicação dupla

Status

ACCEPTED

Data

2026-08-17

Contexto

Ao implementar notificações transacionais (TASK-045 e TASK-046), foram necessárias decisões sobre:

1. Como acionar notificações de email a partir de eventos de domínio (order.cancelled.v1, order.refunded.v1, event.cancelled.v1, order.chargeback.v1) sem criar acoplamento entre módulos.
2. Como garantir exatamente uma entrega de email por evento, mesmo com retentativas do worker ou múltiplas instâncias.
3. Como deduplificar notificações para eventos que não possuem orderId (ex: event.cancelled.v1).

Decisão

**1. Notificações disparadas por polling do outbox, não por chamada direta entre módulos.**

O `OutboxNotificationWorker` lê periodicamente (setInterval, 5s) a tabela `outbox_events`
filtrando tipos de interesse (`HANDLED_TYPES`) e `processed_at IS NULL AND failed_at IS NULL`.
O módulo de pagamentos/eventos não conhece o módulo de notificações — o outbox é o contrato.

**2. Deduplicação em dois níveis na tabela `notification_log`.**

- **Nível order**: `UNIQUE(order_id, event_type) WHERE order_id IS NOT NULL` — impede re-envio
  do mesmo tipo de email para o mesmo order, independentemente do outbox event que o disparou.
- **Nível outbox**: `UNIQUE INDEX notification_log_outbox_event_id ON notification_log (outbox_event_id) WHERE outbox_event_id IS NOT NULL` — usado quando o evento não possui orderId (ex: event.cancelled.v1 — alerta admin sem order específico).

O `SendEmailUseCase` verifica o nível adequado antes de chamar o provider:
- Se `orderId` presente → `hasBeenSent(orderId, eventType)`.
- Se `orderId` ausente mas `outboxEventId` presente → `hasBeenSentForOutboxEvent(outboxEventId)`.

**3. `notification_log.record()` usa `ON CONFLICT DO NOTHING`.**

Mesmo se dois workers correram simultaneamente, apenas um INSERT terá sucesso. O email
pode ter sido enviado duas vezes (race entre check e send), mas a janela é mínima e aceitável
no MVP. Em instância única o risco é zero.

**4. Worker gerenciado pelo lifecycle NestJS (OnModuleInit / OnModuleDestroy).**

O intervalo é iniciado no `onModuleInit` e cancelado no `onModuleDestroy`, garantindo
limpeza correta no desligamento gracioso.

Razões

desacoplamento total: módulo de pagamentos/eventos não importa nada de notificações;
outbox já existia — nenhuma infraestrutura nova (sem RabbitMQ, SQS, etc.);
deduplicação por constraint de banco é mais confiável que flag em memória;
dois índices cobrem os dois cenários reais: eventos com e sem orderId;
ON CONFLICT DO NOTHING elimina erros de concorrência sem retry complexo.

Consequências positivas

qualquer novo evento de domínio pode acionar notificação sem alterar outros módulos;
falha no envio do email não afeta a transação original do domínio;
notification_log provê auditoria de todos os emails enviados;
testes de integração substituem EMAIL_PROVIDER por mock via overrideProvider — sem dependência de SMTP real em CI.

Consequências negativas

o worker usa setInterval sem SELECT FOR UPDATE SKIP LOCKED — safe apenas para instância única no MVP;
sem retry para eventos com failed_at — emails que falham ficam sem reprocessamento;
placeholder de email (comprador@ticket-seller.local) — não há buyer_email em orders no MVP;
latência de notificação é proporcional ao intervalo de polling (5s).

Alternativas consideradas

Chamada direta entre módulos (ex: NotificationsService injetado em ProcessRefundUseCase)

Rejeitado: cria acoplamento bidirecional entre módulos; viola arquitetura hexagonal; dificulta teste isolado.

Fila de mensagens externa (Redis Streams, RabbitMQ, SQS)

Rejeitado para MVP: adiciona infraestrutura nova sem benefício proporcional ao volume atual (< 100 usuários ativos).

Deduplicação apenas por (order_id, event_type)

Rejeitado: event.cancelled.v1 é um alerta administrativo sem orderId — o índice parcial WHERE order_id IS NOT NULL não cobre esse caso, deixando a deduplicação sem efeito.

Impactos

Código

SendEmailUseCase concentra a lógica de deduplicação; handlers no worker são simples (formato de mensagem apenas).
Novo handler: implementar método handle*() no worker e adicionar o tipo a HANDLED_TYPES.

Infraestrutura

Nenhuma infraestrutura adicional para o MVP. Em produção com múltiplas instâncias:
adicionar FOR UPDATE SKIP LOCKED no SELECT do worker antes de escalar horizontalmente.

Segurança

notification_log nunca armazena corpo do email — apenas metadados (destinatário, tipo, timestamps).
Emails de chargeback e event.cancelled vão para backoffice@ticket-seller.local (admin), não para compradores.

Escalabilidade

Com volume alto, substituir setInterval por consumidor de fila (Redis Streams ou SQS)
sem alterar a interface — o outbox continua sendo o contrato.

Migração ou reversão

Para adicionar provider real de email (SendGrid, SES): implementar IEmailProvider e registrar no módulo.
Para adicionar retry: consultar outbox_events WHERE failed_at IS NOT NULL e resetar para reprocessamento.
Para múltiplas instâncias do worker: adicionar SELECT FOR UPDATE SKIP LOCKED no polling.

Referências

TASK-045 — Notification Foundation
TASK-046 — Transactional Notifications
ADR-005 — Confirmação de pagamento e emissão atômica de ingressos (padrão outbox estabelecido)
