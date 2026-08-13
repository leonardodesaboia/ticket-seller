# Módulo: Orders

## Responsabilidade

Controlar o pedido de compra, seus itens, valores, estados e vínculo com reservas e pagamentos.

## Não é responsabilidade

- decidir disponibilidade do estoque;
- processar cartão ou Pix;
- emitir ingresso diretamente;
- calcular repasse do produtor;
- realizar check-in.

---

## Implementado (MVP)

### Cancellation Foundation (TASK-041)

- `POST /api/v1/public/orders/:orderId/cancellations` — comprador cancela PENDING_PAYMENT via `x-reservation-token` (hex64). Sem `X-Organization-Id`. Outbox `order.cancelled.v1` com `requiresRefund: false`.
- `POST /api/v1/organizations/:orgId/orders/:orderId/cancellations` — admin cancela PENDING_PAYMENT ou TICKETS_ISSUED. Outbox `order.cancelled.v1` com `requiresRefund: true` para pós-pagamento.
- `evaluateCancellationEligibility` — função pura: 5 códigos (`CANCELLATION_ALLOWED`, `ORDER_ALREADY_CANCELLED`, `ORDER_IN_TERMINAL_STATE`, `TICKET_ALREADY_USED`, `TICKET_TRANSFER_PENDING`).
- `SELECT ... FOR UPDATE` antes de toda mutação — idempotente sob concorrência.
- Inventário liberado atomicamente: `reserved` (pré-pagamento) ou `committed` (pós-pagamento).
- Tickets → `CANCELLED`, credentials → `REVOKED` no cancelamento pós-pagamento.
- Auditoria em `audit_entries` para operações admin.
- 12 testes unitários + 10 integração (Testcontainers, 1 concorrência).
Entidades
Order

Representa a intenção de compra.

OrderItem

Representa a compra de determinado tipo de ingresso.

OrderBuyer

Representa os dados necessários do comprador no contexto do pedido.

Casos de uso
Comandos
CreateOrder;
AddOrderItem;
RemoveOrderItem;
SubmitOrder;
MarkOrderPaymentPending;
MarkOrderPaid;
CancelOrder;
MarkOrderTicketsIssued;
ApplyOrderRefund;
MarkOrderChargeback.
Consultas
GetOrder;
GetBuyerOrder;
ListOrganizationOrders;
GetOrderSummary.
Estados
CREATED
RESERVED
PAYMENT_PENDING
PAID
TICKETS_ISSUED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
CHARGEBACK
Invariantes
pedido pertence a uma organização;
pedido deve possuir ao menos um item antes do pagamento;
valores são calculados no backend;
preço do item deve ser capturado no momento da criação;
pedido pago não pode ser alterado livremente;
pedido cancelado não pode voltar para pagamento;
pedido não pode ser marcado como pago sem confirmação válida;
emissão deve ocorrer uma única vez;
total do pedido deve ser a soma dos itens, taxas e descontos válidos;
valores monetários usam menor unidade da moeda.
Eventos de domínio
order.created.v1;
order.reserved.v1;
order.payment-pending.v1;
order.paid.v1;
order.cancelled.v1;
order.tickets-issued.v1;
order.partially-refunded.v1;
order.refunded.v1;
order.chargeback.v1.
Portas
OrderRepository;
ReservationPort;
PricingPort;
PaymentPort;
TicketIssuancePort;
IdempotencyRepository;
Clock;
IdGenerator.
Dependências permitidas
reservations;
inventory por porta;
payments por porta;
tickets por evento ou porta;
audit.
Dependências proibidas
SDK de pagamento;
acesso direto ao Redis;
finance como implementação direta;
checkin.
Multi-tenancy

Toda consulta administrativa utiliza:

organizationId + orderId

Comprador consulta apenas pedidos associados à própria identidade ou token seguro.

Segurança
preços não podem ser confiados ao frontend;
cupom e desconto devem ser validados no backend;
respostas públicas não expõem informações internas do produtor;
dados pessoais devem ser minimizados;
alterações administrativas devem ser auditadas.
Concorrência
pagamento e cancelamento simultâneos devem possuir resultado determinístico;
emissão concorrente deve ocorrer uma única vez;
criação repetida com mesma chave não duplica pedido;
reembolso concorrente deve respeitar saldo reembolsável.
Idempotência

Obrigatória em:

criação;
submissão;
confirmação de pagamento;
cancelamento;
emissão;
reembolso.
Testes obrigatórios
criação válida;
pedido sem item;
valor adulterado pelo frontend;
pagamento duplicado;
cancelamento concorrente;
emissão duplicada;
acesso de outra organização;
acesso de outro comprador;
chave idempotente repetida;
transição inválida.
Métricas
orders_created;
orders_paid;
orders_cancelled;
orders_conversion_rate;
order_average_value;
orders_payment_pending;
orders_paid_without_tickets.