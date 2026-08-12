Módulo: Tickets
Responsabilidade

Emitir, armazenar, bloquear, cancelar e disponibilizar ingressos individuais.

Não é responsabilidade
vender estoque;
processar pagamento;
transferir ingresso;
realizar check-in;
calcular repasse.

## Implementado (MVP)

### Tabela tickets
Migration `20260812000013_tickets`.
- `UNIQUE(order_item_id, unit_index)` — idempotência de emissão por unidade.
- `UNIQUE(public_code)` — código público globalmente único.
- `public_code = crypto.randomBytes(32).toString('hex')` — 64 chars hex, imprevisível, sem dados pessoais.
- Status inicial: `ACTIVE`.

### IssueTicketsUseCase
Chamado **dentro da transação** de `ProcessPaymentWebhookUseCase` ao confirmar APPROVED.
Garante: nenhum ticket emitido sem order PAID; emissão idempotente via `ON CONFLICT DO NOTHING`.
Fluxo: para cada item do order → para cada unidade (0..quantity-1) → INSERT ticket.

### GetOrderTicketsUseCase
Valida token de reserva (SHA-256 comparado contra `reservations.continuation_token_hash`).
Retorna lista de tickets do order autenticado.

### Endpoint público
`GET /api/v1/public/orders/:orderId/tickets`
Header: `X-Reservation-Token: <token hex 64>`
Response: `{ orderId, tickets: [{ ticketId, ticketTypeId, orderItemId, unitIndex, publicCode, status }] }`
401 para token inválido; lista vazia se ainda não emitidos.

Entidades
Ticket

Representa o direito individual de entrada.

TicketCode (futuro)

Representa identificador seguro para QR Code regenerável.

Attendee (futuro)

Representa a pessoa indicada para utilizar o ingresso.

Casos de uso implementados
IssueTickets — emite N ingressos por item do order, idempotente.
GetOrderTickets — retorna ingressos de um order autenticado por token.
Casos de uso previstos
ActivateTicket;
BlockTicket;
UnblockTicket;
CancelTicket;
RefundTicket;
UpdateTicketAttendee;
RegenerateTicketCode.
Estados
ACTIVE (emitido após order PAID)
CANCELLED (futuro)
Estados previstos
PENDING
TRANSFER_PENDING
TRANSFERRED
CHECKED_IN
BLOCKED
REFUNDED
Invariantes
ingresso pertence a um order efetivamente PAID (TICKETS_ISSUED);
quantidade emitida corresponde exatamente aos itens do order;
ingresso não pode ser emitido duas vezes para o mesmo (order_item_id, unit_index);
código deve ser imprevisível e único;
emissão deve ser idempotente;
código não contém dados pessoais, preço, orderId ou organização.
Eventos de domínio (outbox)
tickets.issued.v1 — emitido após emissão bem-sucedida no webhook.
Previstos: ticket.activated.v1, ticket.blocked.v1, ticket.unblocked.v1, ticket.cancelled.v1, ticket.refunded.v1, ticket.attendee-updated.v1, ticket.code-regenerated.v1.
Portas
ITicketRepository (TICKET_REPOSITORY) — createIfNotExists, findByOrderId.
IOrderItemsAccessPort (ORDER_ITEMS_ACCESS_PORT) — findOrderWithItems.
ITicketOrderAccessPort (TICKET_ORDER_ACCESS_PORT) — findOrderWithToken.
Dependências permitidas
orders;
events;
audit;
notifications por evento;
object storage por adapter (futuro).
Dependências proibidas
SDK de pagamento;
finance;
acesso direto ao checkin;
acesso direto ao Redis como fonte oficial.
Multi-tenancy

Todo ingresso está associado a uma organização, evento e pedido.

Consultas usam:

organizationId + orderId

Comprador acessa ingressos por token de reserva (nunca por identidade de usuário no MVP).

Segurança
código não deve conter dados pessoais;
código não deve ser sequencial;
acesso autenticado por token de reserva (SHA-256);
token nunca exposto na URL.
Concorrência
emissão simultânea cria apenas um ingresso por unidade: `UNIQUE(order_item_id, unit_index)` + `ON CONFLICT DO NOTHING`;
dois webhooks simultâneos → tickets criados exatamente uma vez.
Idempotência
emissão repetida retorna os mesmos ingressos (ON CONFLICT retorna existente);
cancelamento repetido é seguro (futuro).
Testes implementados
webhook APPROVED → tickets emitidos (N por item);
múltiplos order items → todos tickets emitidos;
emissão idempotente: webhook duplicado não cria duplicados;
publicCode único por ticket;
GET /orders/:orderId/tickets retorna lista correta;
token inválido → 401;
order PENDING_PAYMENT → lista vazia;
concorrência: 2 chamadas simultâneas → apenas um set de tickets.
Métricas previstas
tickets_issued;
ticket_issuance_duration;
tickets_blocked;
tickets_cancelled;
ticket_code_regenerations;
ticket_issuance_failures.
