# TASK-032 — Ticket Issuance

## Status

DONE — MERGED em develop

## Objetivo

Emitir ingressos individuais somente após um order estar oficialmente `PAID`. A emissão ocorre na mesma transação da confirmação de pagamento (chamada internamente por TASK-031).

## Dependências

TASK-031 integrada em develop.

## Propriedade exclusiva

- `apps/api/src/modules/tickets/` (módulo novo)
- `apps/api/prisma/schema.prisma` — adicionar modelo `Ticket`
- `apps/api/prisma/migrations/20260812000013_tickets/`
- `apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts` — chamar IssueTickets dentro da transação

## Fora do escopo

Check-in, QR visual, PDF, transferência, cancelamento de ingresso, módulo finance.

## Modelagem

### tickets

```sql
tickets:
- id              UUID PK
- organization_id UUID NOT NULL FK → organizations
- event_id        UUID NOT NULL FK → events
- order_id        UUID NOT NULL FK → orders
- order_item_id   UUID NOT NULL FK → order_items
- ticket_type_id  UUID NOT NULL FK → ticket_types
- unit_index      INT NOT NULL     -- 0-based dentro do order_item
- public_code     VARCHAR(64) NOT NULL UNIQUE  -- hex 32 bytes via crypto.randomBytes(32)
- status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
- created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

CHECK: status IN ('ACTIVE','CANCELLED')
CHECK: unit_index >= 0
UNIQUE: (order_item_id, unit_index)    -- idempotência de emissão
UNIQUE: public_code
INDEX: (order_id)
INDEX: (organization_id)
INDEX: (event_id)
INDEX: (ticket_type_id)
```

## Módulo hexagonal

```
apps/api/src/modules/tickets/
  domain/
    ticket.entity.ts
    ticket.errors.ts
    ports/
      ticket-repository.port.ts
      ticket-code-generator.port.ts
  application/
    use-cases/
      issue-tickets.use-case.ts    -- chamado internamente em TASK-031
      get-order-tickets.use-case.ts
    ports/
      order-items-access.port.ts
  infrastructure/
    repositories/
      prisma-ticket.repository.ts
    adapters/
      crypto-ticket-code-generator.adapter.ts   -- crypto.randomBytes(32).toString('hex')
      order-items-access.adapter.ts
    tickets.infrastructure.module.ts
  presentation/
    controllers/
      public-tickets.controller.ts
    dto/
      ticket.response.ts
  tickets.module.ts
```

## IssueTickets

Contrato interno (chamado por ProcessPaymentWebhookUseCase dentro da transação):

```typescript
interface IssueTicketsInput {
  orderId: string;
  organizationId: string;
  eventId: string;
  items: Array<{
    orderItemId: string;
    ticketTypeId: string;
    quantity: number;
  }>;
}

interface IssueTicketsResult {
  tickets: Array<{
    id: string;
    publicCode: string;
    orderItemId: string;
    unitIndex: number;
  }>;
}
```

Fluxo:
```
para cada item:
  para cada unidade (0..quantity-1):
    INSERT INTO tickets (order_item_id, unit_index, ...)
    ON CONFLICT (order_item_id, unit_index) DO NOTHING
    RETURNING *
```

Idempotência garantida por `UNIQUE(order_item_id, unit_index)` + `ON CONFLICT DO NOTHING`.

Após emissão, TASK-031 atualiza `order.status = 'TICKETS_ISSUED'` na mesma transação.

## Endpoint de consulta

```
GET /api/v1/public/orders/:orderId/tickets
Headers:
  X-Reservation-Token: <token>

Response 200:
{
  "orderId": "uuid",
  "tickets": [
    {
      "ticketId": "uuid",
      "ticketTypeId": "uuid",
      "orderItemId": "uuid",
      "unitIndex": 0,
      "publicCode": "hex64",
      "status": "ACTIVE"
    }
  ]
}

Response 401: INVALID_RESERVATION_TOKEN
Response 404: ORDER_NOT_FOUND
Response 204 (ou lista vazia): order existe mas tickets ainda não emitidos
```

## Código do ingresso

- `crypto.randomBytes(32).toString('hex')` → 64 chars hex
- Imprevisível, único (UNIQUE constraint)
- Não contém dados pessoais
- Não contém preço, orderId ou organização no código em si
- Não usar IDs sequenciais

## Testes obrigatórios

### Unitários
- IssueTickets cria N tickets para item com quantity N
- IssueTickets com múltiplos items cria tickets corretos
- publicCode tem 64 chars hex
- unit_index correto (0-based)

### Integração (PostgreSQL real)
- order PAID → tickets emitidos (N por item)
- múltiplos order items → todos tickets emitidos
- emissão idempotente: chamada duplicada não cria duplicados
- publicCode único por ticket
- GET /orders/:orderId/tickets retorna lista
- token inválido → 401
- order de outra organização → 404
- order PENDING_PAYMENT → lista vazia (tickets não emitidos ainda)

### Concorrência (PostgreSQL real)
- 2 chamadas simultâneas de IssueTickets no mesmo order → apenas um set de tickets

## Integração com TASK-031

O `ProcessPaymentWebhookUseCase` deve:
1. Chamar `IssueTicketsUseCase` dentro da mesma transação
2. Após emissão bem-sucedida, atualizar `order.status = 'TICKETS_ISSUED'`
3. Emitir `tickets.issued.v1` no outbox

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```
