Módulo: Payments
Responsabilidade

Controlar a representação interna de cobranças, tentativas, confirmações, cancelamentos, reembolsos e eventos de provedores.

Não é responsabilidade
armazenar dados completos de cartão;
decidir estoque;
emitir ingresso diretamente;
calcular saldo contábil final;
realizar check-in.

## Implementado (MVP)

### PaymentGatewayPort
Porta agnóstica de PSP em `domain/ports/payment-gateway.port.ts`.
Token: `PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT')`.
Tipos: `PaymentProvider`, `PaymentMethod`, `InternalPaymentStatus`, `PaymentWebhookEventType`.

### FakePaymentGateway
Adapter em `infrastructure/adapters/fake/fake-payment.gateway.ts`.
- Métodos suportados: `FAKE_PIX`, `FAKE_CREDIT_CARD`.
- `externalPaymentId` determinístico: `'fake_' + SHA256(idempotencyKey).slice(0,32)`.
- Assinatura de webhook via HMAC-SHA256 + `crypto.timingSafeEqual`.
- Secret lido de `FAKE_GATEWAY_SECRET`; obrigatório em produção.

### PaymentAttempt
Tabela `payment_attempts` (migration 20260812000010).
Entidade em `domain/payment-attempt.entity.ts` com `isActive()` e `isTerminal()`.
- Status: `PENDING → APPROVED | DECLINED | CANCELLED | EXPIRED`.
- `UNIQUE(idempotency_key)`, `UNIQUE INDEX(external_payment_id) WHERE NOT NULL`.
- Amount e currency **não** vêm do body — lidos do order.

### PaymentWebhookEvent
Tabela `payment_webhook_events` (migration 20260812000011).
- `UNIQUE(provider, provider_event_id)` para deduplicação.
- `FOR UPDATE` + `ON CONFLICT DO NOTHING` garantem exatamente-uma-vez.

### Endpoints públicos
- `POST /api/v1/public/orders/:orderId/payments` — cria tentativa de pagamento.
- `GET /api/v1/public/orders/:orderId/payments/latest` — consulta última tentativa.
- `POST /api/v1/webhooks/payments/fake` — recebe webhook do FakeGateway com validação HMAC.

Entidades
Payment

Representa a cobrança interna.

PaymentAttempt

Representa uma tentativa de processamento.

ProviderEvent

Representa webhook recebido.

Refund

Representa devolução total ou parcial.

Estados do payment_attempt
PENDING
PROCESSING
APPROVED
DECLINED
CANCELLED
EXPIRED
Estados do order (relacionado)
PENDING_PAYMENT → PAID → TICKETS_ISSUED (via webhook APPROVED)
PENDING_PAYMENT → CANCELLED
PENDING_PAYMENT → EXPIRED
Estados do reembolso (futuro)
REQUESTED
PROCESSING
SUCCEEDED
FAILED
CANCELLED
Casos de uso implementados
ProcessPaymentWebhook — confirma order, faz commit de inventory, emite tickets, todos na mesma transação.
CreatePaymentAttempt — valida token, order, tentativa ativa e idempotência; chama gateway.
GetLatestPaymentAttempt — consulta última tentativa por order.
Casos de uso previstos
CancelPayment;
RequestRefund;
ProcessRefund;
MarkChargeback;
RetryUnknownPayment;
RegisterProviderAccount.
Invariantes
pagamento pertence a um pedido;
valor deve coincidir com o valor autorizado do pedido (validado no webhook);
order PAID não pode regredir para PENDING_PAYMENT;
pagamento reembolsado não pode ser pago novamente;
mesmo evento externo não pode ser processado mais de uma vez;
timeout não significa falha definitiva;
estado externo deve ser traduzido para estado interno;
provider e identificador externo devem ser armazenados;
CVV e PAN nunca armazenados.
Eventos de domínio (outbox)
payment.created.v1;
payment.approved.v1;
order.paid.v1;
inventory.committed.v1;
order.tickets-issued.v1;
tickets.issued.v1;
payment.declined.v1;
payment.cancelled.v1.
Portas
PaymentGatewayPort (PAYMENT_GATEWAY_PORT);
IPaymentAttemptRepository (PAYMENT_ATTEMPT_REPOSITORY);
IOrderAccessPort (ORDER_ACCESS_PORT);
IInventoryCommitPort.
Dependências permitidas
orders;
inventory (por porta);
tickets (IssueTicketsUseCase chamado na transação de confirmação);
finance por evento ou porta;
audit;
antifraud;
adapters de PSP dentro da infraestrutura.
Dependências proibidas
SDK do PSP no domínio;
armazenamento de CVV.
Multi-tenancy

Todo pagamento é associado à organização do pedido.

Consultas usam:

organizationId + paymentId

Eventos do PSP são vinculados ao tenant por dados internos confiáveis (via payment_attempt → order → organization).

Segurança
validar assinatura de webhook via HMAC-SHA256 com `crypto.timingSafeEqual`;
preservar corpo bruto (`rawBody: true` no Fastify);
nunca registrar cartão completo, CVV ou token sensível;
retornar 400 sem detalhes para assinatura inválida (não revelar motivo ao PSP);
utilizar idempotência;
responder rapidamente ao PSP;
verificar values e moeda antes de confirmar PAID;
processar lógica pesada em worker (futuro).
Concorrência
webhook duplicado processado exatamente uma vez: `FOR UPDATE` + `ON CONFLICT DO NOTHING`;
dois webhooks APPROVED simultâneos resultam em order PAID uma única vez;
cancelamento e confirmação simultâneos possuem resultado determinístico.
Idempotência
criação de tentativa: `UNIQUE(idempotency_key)`;
processamento de webhook: `UNIQUE(provider, provider_event_id)`;
emissão de ticket: delegada ao módulo tickets.
Testes implementados
assinatura válida → 200;
assinatura inválida → 400;
APPROVED → order TICKETS_ISSUED, inventory committed, attempt APPROVED, outbox emitido;
DECLINED → attempt DECLINED, order permanece PENDING_PAYMENT;
webhook duplicado → 200 idempotente;
amount divergente → order permanece PENDING_PAYMENT;
concorrência: 2 webhooks simultâneos → TICKETS_ISSUED uma vez.
Métricas previstas
payments_created;
payments_paid;
payments_failed;
payment_approval_rate;
payment_processing_duration;
duplicate_provider_events;
refunds_requested;
refunds_failed;
payments_unknown_state.
