ADR-005 — Confirmação de pagamento server-to-server e emissão atômica de ingressos
Status

ACCEPTED

Data

2026-08-12

Contexto

Ao implementar o fluxo de pagamento (TASK-029 a TASK-032) foram necessárias decisões sobre:

1. Como um order passa para o estado PAID de forma segura.
2. Onde e quando os ingressos são emitidos em relação à confirmação do pagamento.
3. Como garantir idempotência e ausência de duplicações em cenários de falha e concorrência.

Decisão

**1. Order só passa para PAID via webhook server-to-server validado criptograficamente.**

O frontend nunca é fonte oficial de confirmação de pagamento.
A transição PENDING_PAYMENT → PAID ocorre exclusivamente no handler do webhook do PSP,
após validação da assinatura HMAC-SHA256 com `crypto.timingSafeEqual`.

**2. Emissão de ingressos ocorre na mesma transação de confirmação do webhook.**

O `ProcessPaymentWebhookUseCase` executa, em uma única transação PostgreSQL:
- UPDATE payment_attempt → APPROVED;
- UPDATE order → PAID;
- UPDATE ticket_inventory (committed += qty, reserved -= qty);
- INSERT tickets (ON CONFLICT DO NOTHING);
- UPDATE order → TICKETS_ISSUED;
- INSERT outbox_events.

Não há estado intermediário onde um order está PAID sem ingressos emitidos.

**3. Idempotência em cada camada:**

- Webhook event: `UNIQUE(provider, provider_event_id)` + `INSERT ... ON CONFLICT DO NOTHING`.
- Ticket: `UNIQUE(order_item_id, unit_index)` + `INSERT ... ON CONFLICT DO NOTHING`.
- Concorrência: `SELECT ... FOR UPDATE` no order antes de qualquer transição.

**4. Preservação do rawBody para verificação HMAC.**

`NestFactory.create<NestFastifyApplication>(adapter, { rawBody: true })` preserva o
corpo bruto da requisição sem dependência adicional, habilitando verificação HMAC
contra o body original antes de qualquer parse JSON.

Razões
garantia de que nenhum ingresso é emitido sem pagamento confirmado pelo PSP;
ausência de estado inconsistente entre order PAID e ingressos emitidos;
resistência a falhas parciais: a transação reverte se qualquer passo falhar;
resistência a chamadas duplicadas: ON CONFLICT DO NOTHING é idempotente;
resistência a concorrência: FOR UPDATE serializa processamento do mesmo order;
prevenção de timing attacks na verificação de assinatura;
frontend nunca é ponto de confiança para dados financeiros.
Consequências positivas
consistência forte entre pagamento, estoque e ingressos;
idempotência garantida por constraints do banco, não por lógica de aplicação;
retentativas do PSP são seguras;
dois webhooks simultâneos resultam em exatamente uma transição;
rollback total em caso de erro: nenhum efeito parcial.
Consequências negativas
a transação é mais longa do que uma simples atualização de status;
emissão síncrona aumenta tempo de processamento do webhook;
em volume alto, a emissão de muitos ingressos por webhook poderá exigir extração para worker.
Alternativas consideradas
Emitir ingressos em worker assíncrono após confirmação do order

Rejeitado para o MVP por introduzir estado intermediário PAID-sem-ingressos
que exigiria polling extra no frontend e complexidade de retry.

Confirmar pagamento pelo frontend (callback do PSP diretamente no browser)

Rejeitado: frontend não é fonte confiável; dados do PSP podem ser manipulados.

Usar Redis como lock de idempotência em vez de constraints do banco

Rejeitado: Redis não é fonte oficial de nenhuma invariante de negócio neste projeto
(ADR-002 e AGENTS.md §8).

Impactos
Código

ProcessPaymentWebhookUseCase concentra a lógica de confirmação; qualquer
novo PSP implementa PaymentGatewayPort e o usecase reutiliza o mesmo fluxo.

Segurança

Assinatura HMAC obrigatória em todo webhook; 400 sem detalhes para assinatura inválida;
rawBody nunca registrado em log.

Escalabilidade

A emissão síncrona de ingressos pode se tornar gargalo com orders de grande volume.
Quando necessário, extrair a emissão para um worker que processa o evento outbox
`tickets.issued.v1` sem alterar a interface do webhook.

Migração ou reversão

Adicionar um novo PSP: implementar adapter de PaymentGatewayPort e registrar no módulo.
Extrair emissão para worker: substituir INSERT direto no usecase por publicação
de evento outbox; o worker consome e emite os ingressos de forma idempotente.
