# TASK-027 — Order Foundation

## Status

MERGED em develop

## Objetivo

Criar a fundação de pedidos a partir de uma reserva válida. Ainda sem pagamento.

Fluxo:
```
reservation ACTIVE
→ POST /public/orders
→ order PENDING_PAYMENT
→ reservation CONSUMED
→ checkout preparado
```

## Dependências

TASK-026 integrada em develop. Contratos de TASK-025/026 FROZEN.

## Propriedade exclusiva

- `apps/api/src/modules/orders/` (módulo novo)
- `apps/api/prisma/schema.prisma` — adicionar `Order` e `OrderItem`
- `apps/api/prisma/migrations/20260811000008_orders/`

## Fora do escopo

Pagamento, emissão de ingresso, reembolso, taxa comercial definitiva, comissão, desconto, parcelamento, antifraude, payout.

## Modelagem

### orders

```sql
orders:
- id               UUID PK
- organization_id  UUID NOT NULL
- event_id         UUID NOT NULL FK → events
- reservation_id   UUID NOT NULL FK → reservations UNIQUE
- status           VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT'
- currency         VARCHAR(3) NOT NULL
- subtotal_amount  BIGINT NOT NULL
- total_amount     BIGINT NOT NULL
- idempotency_key  VARCHAR(255) UNIQUE NULL
- expires_at       TIMESTAMPTZ NOT NULL  -- herdado da reserva
- created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()

CHECK: status IN ('PENDING_PAYMENT','CANCELLED','EXPIRED')
CHECK: total_amount >= subtotal_amount
UNIQUE INDEX: reservation_id
INDEX: (organization_id)
INDEX: (status)
INDEX: (expires_at)
```

### order_items

```sql
order_items:
- id                UUID PK
- order_id          UUID NOT NULL FK → orders
- ticket_type_id    UUID NOT NULL FK → ticket_types
- name_snapshot     VARCHAR(500) NOT NULL
- unit_price_amount BIGINT NOT NULL
- quantity          INT NOT NULL
- subtotal_amount   BIGINT NOT NULL

CHECK: quantity > 0
CHECK: subtotal_amount = unit_price_amount * quantity
INDEX: (order_id)
```

## Módulo hexagonal

```
apps/api/src/modules/orders/
  domain/
    order.entity.ts
    order-item.entity.ts
    order.errors.ts
    ports/
      order-repository.port.ts
  application/
    use-cases/
      create-order.use-case.ts
      get-order.use-case.ts
    ports/
      reservation-access.port.ts
  infrastructure/
    repositories/
      prisma-order.repository.ts
    adapters/
      reservation-access.adapter.ts
    orders.infrastructure.module.ts
  presentation/
    controllers/
      public-orders.controller.ts
    dto/
      create-order.dto.ts
      order.response.ts
  orders.module.ts
```

## Contratos

### Criar pedido

```
POST /api/v1/public/orders
Headers:
  X-Reservation-Token: <token>
  Idempotency-Key: <uuid>
  Content-Type: application/json

Body:
{
  "reservationId": "uuid"
}

Response 201:
{
  "orderId": "uuid",
  "reservationId": "uuid",
  "status": "PENDING_PAYMENT",
  "currency": "BRL",
  "subtotalAmount": 10000,
  "totalAmount": 10000,
  "expiresAt": "ISO8601",
  "items": [
    {
      "ticketTypeId": "uuid",
      "name": "Inteira",
      "quantity": 2,
      "unitPriceAmount": 5000,
      "subtotalAmount": 10000
    }
  ]
}
```

### Consultar pedido

```
GET /api/v1/public/orders/:orderId
Headers:
  X-Reservation-Token: <token>

Response 200: mesmo shape
```

## Erros RFC 9457

```
401 INVALID_RESERVATION_TOKEN
404 RESERVATION_NOT_FOUND
409 IDEMPOTENCY_CONFLICT
409 ORDER_ALREADY_EXISTS    — reservation_id já tem pedido (UNIQUE)
410 RESERVATION_EXPIRED
422 RESERVATION_CANCELLED
422 RESERVATION_ALREADY_CONSUMED  — reserva já foi usada em outro pedido
```

## Regras

- Reserva deve existir e estar ACTIVE.
- Reserva não pode estar expirada (`expires_at > NOW()`).
- Token de continuação válido (hash match).
- Criar pedido e marcar reserva como CONSUMED na mesma transação.
- Copiar snapshot dos itens da reserva para `order_items`.
- `totalAmount = subtotalAmount` (taxas TBD — registrar como pendência).
- `expiresAt` do pedido = `expiresAt` da reserva.
- UNIQUE em `reservation_id` garante que só um pedido pode ser criado por reserva.

## Fluxo transacional

```
1. Validar Idempotency-Key
2. Buscar reserva por ID
3. Verificar token (hash)
4. Verificar status ACTIVE e expires_at > NOW()
5. Verificar UNIQUE(reservation_id) — pedido não existe ainda
6. Criar order + order_items
7. UPDATE reservations SET status = 'CONSUMED'
8. Emitir outbox order.created.v1
9. Retornar order
```

## Inventory

- `reserved` permanece inalterado ao criar pedido.
- `committed` só muda quando pagamento for confirmado (fase futura).
- Pedido `PENDING_PAYMENT` mantém o `reserved` da reserva.

## ExpiresAt

- `order.expiresAt = reservation.expiresAt`
- Se pedido expirar (worker futuro): liberar inventory (`reserved -= quantidade`), atualizar status para EXPIRED.

## Outbox

- `order.created.v1`

## Testes obrigatórios

### Integração (PostgreSQL real)

- pedido criado de reserva válida;
- snapshot correto dos itens;
- moeda correta;
- subtotal e total corretos em minor units;
- reserva fica CONSUMED após criação do pedido;
- reserva expirada → 410;
- reserva cancelada → 422;
- reserva já consumida → 422;
- token inválido → 401;
- idempotência: mesma chave + mesmo payload → retorna pedido original;
- idempotência: mesma chave + payload diferente → 409;
- UNIQUE(reservation_id): segundo pedido para mesma reserva → 409;
- total sem taxa fictícia;
- inventory permanece consistente (reserved não muda ao criar pedido).

### Concorrência (PostgreSQL real)

- 2 requisições simultâneas criando pedido para a mesma reserva → apenas 1 vence (UNIQUE constraint), outra recebe 409.

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```
