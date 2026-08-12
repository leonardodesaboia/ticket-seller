# Módulo: Tickets

## Responsabilidade

Emitir, armazenar, bloquear, cancelar, disponibilizar e rotacionar credenciais de ingressos individuais.

## Não é responsabilidade

- vender estoque;
- processar pagamento;
- transferir ingresso;
- realizar check-in;
- calcular repasse.

---

## Implementado (MVP)

### Tabela `tickets`

Migration `20260812000013_tickets`.

- `UNIQUE(order_item_id, unit_index)` — idempotência de emissão por unidade.
- `UNIQUE(public_code)` — código público globalmente único.
- `public_code = crypto.randomBytes(32).toString('hex')` — 64 chars hex, imprevisível, sem dados pessoais.
- Status inicial: `ACTIVE`.

### Tabela `ticket_credentials`

Migration `20260812000014_ticket_credentials`.

- `token_hash VARCHAR(64) UNIQUE` — SHA-256 do token; **plaintext nunca armazenado**.
- `status VARCHAR(20)` — `ACTIVE` ou `REVOKED`.
- `version INT` — incrementado a cada rotação.
- `PARTIAL UNIQUE INDEX (ticket_id) WHERE status='ACTIVE'` — no máximo uma credencial ativa por ticket.

### IssueTicketsUseCase

Chamado **dentro da transação** de `ProcessPaymentWebhookUseCase` ao confirmar APPROVED.
Garante: nenhum ticket emitido sem order PAID; emissão idempotente via `ON CONFLICT DO NOTHING`.
Fluxo: para cada item do order → para cada unidade (0..quantity-1) → INSERT ticket.

### GetOrderTicketsUseCase

Valida token de reserva (SHA-256 comparado contra `reservations.continuation_token_hash`).
Retorna lista de tickets do order autenticado.

### IssueTicketCredentialUseCase

Emite nova credencial para um ticket autenticado por token de reserva.
Cada chamada a `POST .../credential` revoga a credencial anterior e cria nova — o token exibido no QR é sempre o mais recente.
Token gerado com `crypto.randomBytes(32).toString('hex')`; hash armazenado.

### AdmissionPolicy

Função pura (sem IO, sem DI) que avalia 7 condições em ordem determinística:

```
INVALID_CREDENTIAL → TICKET_CANCELLED → WRONG_EVENT → EVENT_NOT_ACTIVE
→ TRANSFER_PENDING → ALREADY_CHECKED_IN → VALID
```

`allowed = true` somente para `VALID`.

### Endpoints públicos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/v1/public/orders/:orderId/tickets` | X-Reservation-Token | Lista tickets do order |
| POST | `/api/v1/public/orders/:orderId/tickets/:ticketId/credential` | X-Reservation-Token | Emite/rotaciona credencial |
| GET | `/api/v1/public/orders/:orderId/tickets/:ticketId/credential` | X-Reservation-Token | Verifica existência de credencial |

---

## Entidades

### Ticket

Representa o direito individual de entrada. Imutável após emissão (exceto `status`).

### TicketCredential

Representa credencial rotacionável para QR Code. Token armazenado apenas como hash.

### Attendee (futuro)

Representa a pessoa indicada para utilizar o ingresso.

---

## Casos de uso implementados

- `IssueTickets` — emite N ingressos por item do order, idempotente.
- `GetOrderTickets` — retorna ingressos de um order autenticado por token.
- `IssueTicketCredentialUseCase` — emite/rotaciona credencial; token plaintext retornado apenas uma vez.
- `GetTicketCredentialUseCase` — verifica se credencial ativa existe.
- `AdmissionPolicy` — lógica pura de admissão (7 códigos estáveis).

## Casos de uso previstos

- `ActivateTicket`;
- `BlockTicket`;
- `UnblockTicket`;
- `CancelTicket`;
- `RefundTicket`;
- `UpdateTicketAttendee`;
- `InitiateTransfer`;
- `AcceptTransfer`;
- `CancelTransfer`.

---

## Estados do ticket

| Status | Descrição |
|--------|-----------|
| `ACTIVE` | Emitido após order PAID |
| `CANCELLED` | Cancelado (futuro) |

## Estados da credencial

| Status | Descrição |
|--------|-----------|
| `ACTIVE` | Credencial válida para scan |
| `REVOKED` | Revogada por rotação ou transferência |

---

## Invariantes

- Ingresso pertence a um order efetivamente PAID (`TICKETS_ISSUED`).
- Quantidade emitida corresponde exatamente aos itens do order.
- Ingresso não pode ser emitido duas vezes para o mesmo `(order_item_id, unit_index)`.
- `public_code` deve ser imprevisível e único; não contém dados pessoais, preço, `orderId` ou organização.
- `credentialToken` (plaintext) **nunca** é armazenado — apenas `token_hash = SHA-256(token)`.
- `token_hash` **nunca** aparece em response de API.
- No máximo uma credencial `ACTIVE` por ticket (partial unique index).
- QR payload = apenas o `credentialToken` — sem PII.

---

## Eventos de domínio (outbox)

- `tickets.issued.v1` — emitido após emissão bem-sucedida no webhook.
- Previstos: `ticket.cancelled.v1`, `ticket.credential-rotated.v1`, `ticket.transfer-initiated.v1`, `ticket.transfer-accepted.v1`.

---

## Portas

| Símbolo | Interface | Descrição |
|---------|-----------|-----------|
| `TICKET_REPOSITORY` | `ITicketRepository` | `createIfNotExists`, `findByOrderId` |
| `TICKET_CREDENTIAL_REPOSITORY` | `ITicketCredentialRepository` | `findActiveByTicketId`, `findByTokenHash`, `createIfNoneActive`, `rotateCredential` |
| `ORDER_ITEMS_ACCESS_PORT` | `IOrderItemsAccessPort` | `findOrderWithItems` |
| `TICKET_ORDER_ACCESS_PORT` | `ITicketOrderAccessPort` | `findOrderWithToken` |

---

## Dependências permitidas

- `orders`;
- `events`;
- `audit`;
- `notifications` por evento;
- `object storage` por adapter (futuro).

## Dependências proibidas

- SDK de pagamento;
- `finance`;
- acesso direto ao `checkin`;
- acesso direto ao Redis como fonte oficial.

---

## Multi-tenancy

Todo ingresso está associado a uma organização, evento e pedido. Consultas usam `organizationId + orderId`. Credenciais filtram por `organization_id`. Comprador acessa ingressos por token de reserva (nunca por identidade de usuário no MVP).

---

## Segurança

- `public_code` não contém dados pessoais nem sequenciais.
- `credentialToken` retornado apenas uma vez no POST; servidor não pode recuperar o plaintext.
- Acesso autenticado por token de reserva (SHA-256 comparado com timing seguro).
- Token nunca exposto na URL.
- QR payload nunca contém PII, preço ou IDs internos.

---

## Concorrência

- Emissão simultânea: `UNIQUE(order_item_id, unit_index)` + `ON CONFLICT DO NOTHING` → exatamente um ticket por unidade.
- Credencial simultânea: partial unique index `(ticket_id) WHERE status='ACTIVE'` + `$transaction` sequencial → exatamente uma credencial ativa.
- Dois webhooks APPROVED simultâneos → tickets criados exatamente uma vez.

---

## Idempotência

- Emissão repetida: `ON CONFLICT DO NOTHING` retorna existente.
- Credencial: cada POST rotaciona — não há "retornar token existente" (plaintext não armazenado).

---

## Testes implementados

- Webhook APPROVED → tickets emitidos (N por item).
- Múltiplos order items → todos tickets emitidos.
- Emissão idempotente: webhook duplicado não cria duplicados.
- `publicCode` único por ticket.
- `GET /orders/:orderId/tickets` retorna lista correta.
- Token de reserva inválido → 401.
- Order `PENDING_PAYMENT` → lista vazia.
- Concorrência: 2 chamadas simultâneas → apenas um set de tickets.
- POST credential: token 64 hex, não igual ao `token_hash`.
- POST credential duas vezes → credencial rotacionada.
- `token_hash` ausente das respostas.
- Concorrência de credencial: 2 POSTs simultâneos → uma credencial `ACTIVE`.

---

## Métricas previstas

- `tickets_issued`;
- `ticket_issuance_duration`;
- `tickets_blocked`;
- `tickets_cancelled`;
- `ticket_credentials_issued`;
- `ticket_credential_rotations`;
- `ticket_issuance_failures`.
