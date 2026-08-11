# TASK-026 — Reservation Holds

## Status

READY (TASK-025 integrada; aguarda implementação)

## Objetivo

Criar reservas temporárias de inventário para o comprador. Uma reserva garante quantidade enquanto o comprador continua o checkout.

## Dependências

TASK-025 integrada em develop. Contrato de TASK-025 FROZEN.

## Propriedade exclusiva

- `apps/api/src/modules/reservations/` (módulo novo)
- `apps/api/prisma/schema.prisma` — adicionar `Reservation` e `ReservationItem`
- `apps/api/prisma/migrations/20260811000007_reservations/`
- `apps/api/src/modules/inventory/application/use-cases/try-reserve-inventory.use-case.ts` (criado em TASK-025 mas invocado por este módulo)
- `apps/api/src/modules/inventory/application/use-cases/release-inventory-hold.use-case.ts` (idem)

## Fora do escopo

Pedidos, pagamento, emissão de ingresso, autenticação de usuário completa, Redis.

## Modelagem

### reservations

```sql
reservations:
- id                     UUID PK
- organization_id        UUID NOT NULL
- event_id               UUID NOT NULL FK → events
- status                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
- continuation_token_hash VARCHAR(64) NOT NULL  -- SHA-256 hex do token
- idempotency_key        VARCHAR(255) UNIQUE NULL
- expires_at             TIMESTAMPTZ NOT NULL
- currency               VARCHAR(3) NOT NULL
- subtotal_amount        BIGINT NOT NULL DEFAULT 0
- created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
- updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()

CHECK: status IN ('ACTIVE','CONSUMED','EXPIRED','CANCELLED')
INDEX: (organization_id, event_id)
INDEX: (expires_at)
INDEX: (status)
```

### reservation_items

```sql
reservation_items:
- id                UUID PK
- reservation_id    UUID NOT NULL FK → reservations
- ticket_type_id    UUID NOT NULL FK → ticket_types
- quantity          INT NOT NULL
- name_snapshot     VARCHAR(500) NOT NULL
- unit_price_amount BIGINT NOT NULL
- currency          VARCHAR(3) NOT NULL
- subtotal_amount   BIGINT NOT NULL

CHECK: quantity > 0
INDEX: (reservation_id)
INDEX: (ticket_type_id)
```

## Token de continuação

- Gerar 32 bytes criptograficos via `crypto.randomBytes(32)`.
- Converter para hex (64 chars).
- Armazenar SOMENTE o hash SHA-256 na coluna `continuation_token_hash`.
- Retornar o token hex **uma única vez** no body da resposta de criação.
- **Nunca** logar o token ou incluí-lo em erros.
- Comparação: `SHA256(receivedToken) === continuation_token_hash`.

## TTL

15 minutos. Gerado pelo servidor:

```
expiresAt = NOW() + 15 minutes
```

Não confiar no relógio do cliente.

## Módulo hexagonal

```
apps/api/src/modules/reservations/
  domain/
    reservation.entity.ts
    reservation-item.entity.ts
    reservation.errors.ts
    ports/
      reservation-repository.port.ts
  application/
    use-cases/
      create-reservation.use-case.ts
      get-reservation.use-case.ts
      cancel-reservation.use-case.ts
    ports/
      inventory-hold.port.ts   -- porta para comunicar com inventory
      event-access.port.ts     -- porta para buscar evento e ticket types por slug
  infrastructure/
    repositories/
      prisma-reservation.repository.ts
    adapters/
      inventory-hold.adapter.ts   -- implementa InventoryHoldPort
      event-access.adapter.ts     -- implementa EventAccessPort
    reservations.infrastructure.module.ts
  presentation/
    controllers/
      public-reservations.controller.ts
    dto/
      create-reservation.dto.ts
      reservation.response.ts
  reservations.module.ts
```

## Contratos

### Criar reserva

```
POST /api/v1/public/reservations
Headers:
  Idempotency-Key: <uuid> (obrigatório)
  Content-Type: application/json

Body:
{
  "eventSlug": "string",
  "items": [
    { "ticketTypeId": "uuid", "quantity": 2 }
  ]
}

Response 201:
{
  "reservationId": "uuid",
  "token": "string (hex 64 chars — retornado UMA VEZ)",
  "status": "ACTIVE",
  "expiresAt": "ISO8601",
  "currency": "BRL",
  "subtotalAmount": 10000,
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

### Consultar reserva

```
GET /api/v1/public/reservations/:reservationId
Headers:
  X-Reservation-Token: <token>

Response 200: mesmo shape sem o campo "token"
Response 401: INVALID_RESERVATION_TOKEN
Response 404: não encontrada
Response 410: RESERVATION_EXPIRED
```

### Cancelar reserva

```
DELETE /api/v1/public/reservations/:reservationId
Headers:
  X-Reservation-Token: <token>

Response 204: cancelada com sucesso
Response 401: INVALID_RESERVATION_TOKEN
Response 404: não encontrada
Response 409: RESERVATION_ALREADY_CONSUMED
Response 410: RESERVATION_EXPIRED (cancelamento de reserva expirada é aceito silenciosamente — 204)
```

## Erros RFC 9457

```
400 INVALID_ITEMS        — items vazio ou quantidade <= 0
401 INVALID_RESERVATION_TOKEN
404 EVENT_NOT_FOUND
404 TICKET_TYPE_NOT_FOUND
409 IDEMPOTENCY_CONFLICT — mesma chave, payload diferente
409 RESERVATION_ALREADY_CONSUMED
410 RESERVATION_EXPIRED
422 INSUFFICIENT_INVENTORY
422 TICKET_TYPE_INACTIVE
422 EVENT_NOT_PUBLISHED
```

## Idempotência

- `Idempotency-Key` obrigatório na criação.
- Armazenar chave + hash do payload na tabela `idempotency_records` existente.
- Mesma chave + mesmo payload → retorna reserva original com 201.
- Mesma chave + payload diferente → 409.

## Expiração e lazy cleanup

- Disponibilidade em TASK-025 já ignora reservas expiradas via JOIN.
- Cancelamento de reserva expirada: responde 204 (idempotente).
- Worker de limpeza periódica: fora do escopo desta task, mas infraestrutura de query já deve suportar `UPDATE reservations SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at <= NOW()`.

## Fluxo de criação (transacional)

```
1. Validar Idempotency-Key (idempotency_records)
2. Buscar evento por slug (PUBLISHED)
3. Validar ticket types (ACTIVE, pertencentes ao evento)
4. Para cada ticket type: TryReserveInventory (SQL atômico)
5. Se qualquer falha: rollback de todos os reservas já feitas
6. Criar reservation + reservation_items (mesma transação)
7. Emitir outbox event reservation.created.v1
8. Retornar reservation + token
```

## Outbox

- `reservation.created.v1`
- `reservation.cancelled.v1`
- `reservation.expired.v1` (emitido pelo worker futuro)

## Testes obrigatórios

### Integração (PostgreSQL real)

- reserva válida com 1 ticket type;
- reserva válida com múltiplos ticket types;
- preço vindo do backend (ignorar qualquer preço no body);
- currency vindo do evento;
- ticket type inativo → 422;
- evento não publicado → 422;
- quantidade 0 → 400;
- quantidade negativa → 400;
- quantidade acima da disponibilidade → 422 INSUFFICIENT_INVENTORY;
- idempotência: mesma chave + mesmo payload → retorna reserva original;
- idempotência: mesma chave + payload diferente → 409;
- token inválido em GET → 401;
- token inválido em DELETE → 401;
- acesso a reserva de outro evento → 404;
- cancelamento → status CONSUMED, inventory liberado;
- cancelamento repetido → 204 (idempotente);
- cancelamento de reserva expirada → 204;
- snapshot de preço: alterar preço do ticket type após reserva não altera itens da reserva;
- subtotal calculado em minor units correto;
- total = soma dos subtotals.

### Concorrência (PostgreSQL real)

- 2 reservas simultâneas disputando o último ingresso;
- rollback de uma reserva parcial quando segundo item falha por estoque.

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```
