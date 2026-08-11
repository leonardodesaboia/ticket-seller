# TASK-025 — Inventory Foundation

## Status

READY

## Objetivo

Criar a fundação transacional de inventário dos tipos de ingresso.

O sistema deve saber, com segurança:

- capacidade configurada;
- quantidade reservada (holds ativos, não expirados);
- quantidade comprometida (vendas confirmadas por pagamento);
- quantidade disponível = capacity - effective_reserved - committed.

Deve impedir overselling mesmo com múltiplas requisições concorrentes.

## Dependências

TASK-024 integrada e contrato FROZEN. Parte da develop.

## Propriedade exclusiva

- `apps/api/src/modules/inventory/` (módulo novo — criar tudo aqui)
- `apps/api/prisma/schema.prisma` — adicionar modelo `TicketInventory`
- `apps/api/prisma/migrations/20260811000006_ticket_inventory/`
- `apps/api/src/modules/events/application/use-cases/publish-event.use-case.ts` — chamar inicialização do inventory
- `apps/api/src/modules/events/presentation/dto/public-event.response.ts` — adicionar `ticketTypeId`
- `apps/api/src/modules/events/presentation/controllers/public-events.controller.ts` — registrar novo availability endpoint

## Fora do escopo

Reservas, pedidos, pagamentos, emissão de ingresso, check-in, Redis.

## Modelagem

### ticket_inventory

```sql
ticket_inventory:
- id             UUID PK
- ticket_type_id UUID UNIQUE FK → ticket_types
- event_id       UUID FK → events
- organization_id UUID NOT NULL
- capacity       INT NOT NULL
- reserved       INT NOT NULL DEFAULT 0
- committed      INT NOT NULL DEFAULT 0
- version        INT NOT NULL DEFAULT 1
- created_at     TIMESTAMPTZ
- updated_at     TIMESTAMPTZ

CHECK: capacity - reserved - committed >= 0
CHECK: reserved >= 0
CHECK: committed >= 0
CHECK: reserved + committed <= capacity
UNIQUE INDEX: ticket_type_id
INDEX: event_id, organization_id
```

## Invariantes

- `available >= 0` sempre
- `reserved + committed <= capacity` sempre
- Overselling nunca ocorre
- Reservas expiradas não contam para `effective_reserved`

## SQL de concorrência (obrigatório)

```sql
UPDATE ticket_inventory
SET reserved = reserved + $quantity,
    version  = version + 1,
    updated_at = NOW()
WHERE ticket_type_id = $ticketTypeId
  AND organization_id = $organizationId
  AND (capacity - reserved - committed) >= $quantity
RETURNING *
```
0 rows → `INSUFFICIENT_INVENTORY`.

## Cálculo de disponibilidade (lazy expiration)

Não usar `ticket_inventory.reserved` diretamente para disponibilidade. Calcular via join:

```sql
SELECT
  ti.capacity
    - COALESCE(active.total_reserved, 0)
    - ti.committed AS available_quantity
FROM ticket_inventory ti
LEFT JOIN (
  SELECT ri.ticket_type_id, SUM(ri.quantity) AS total_reserved
  FROM reservation_items ri
  JOIN reservations r ON r.id = ri.reservation_id
  WHERE r.status = 'ACTIVE'
    AND r.expires_at > NOW()
  GROUP BY ri.ticket_type_id
) active ON active.ticket_type_id = ti.ticket_type_id
WHERE ti.ticket_type_id = $ticketTypeId
  AND ti.organization_id = $organizationId
```

Isso garante que reservas expiradas não bloqueiam estoque mesmo sem worker de limpeza.

Nota: as tabelas `reservations` e `reservation_items` serão criadas em TASK-026. Para TASK-025, o endpoint de availability pode retornar `capacity - committed` (sem reservas ainda) com comentário explícito que será completado em TASK-026.

## Inicialização do inventory

Quando `publish-event.use-case.ts` executa a publicação do evento, deve também inicializar um `ticket_inventory` para cada `TicketType` com `status = 'ACTIVE'` do evento:

```
capacity = ticketType.capacity
reserved = 0
committed = 0
```

Executar dentro da mesma transação da publicação.

## Módulo hexagonal

```
apps/api/src/modules/inventory/
  domain/
    ticket-inventory.entity.ts
    inventory.errors.ts
    ports/
      inventory-repository.port.ts
  application/
    use-cases/
      initialize-event-inventory.use-case.ts
      try-reserve-inventory.use-case.ts   (usado em TASK-026)
      release-inventory-hold.use-case.ts  (usado em TASK-026)
      get-availability.use-case.ts
    ports/
      inventory-initialization.port.ts
  infrastructure/
    repositories/
      prisma-inventory.repository.ts
    inventory.infrastructure.module.ts
  presentation/
    controllers/
      public-availability.controller.ts
    dto/
      availability.response.ts
  inventory.module.ts
```

## Contratos

### Novo endpoint

```
GET /api/v1/public/events/:slug/availability

Response 200:
{
  "eventSlug": "string",
  "items": [
    { "ticketTypeId": "uuid", "availableQuantity": 42 }
  ]
}

Response 404: evento não encontrado ou não publicado (RFC 9457)
Cache-Control: public, max-age=10, stale-while-revalidate=30
```

### Evolução do contrato público (public-event.response.ts)

Adicionar `ticketTypeId: string` ao `PublicTicketTypeResponse`. Necessário para TASK-028 poder enviar itens na reserva.

## Alteração de capacidade

- Em DRAFT: produtor pode alterar `ticket_types.capacity` normalmente.
- Após publicação: não permitir reduzir `ticket_types.capacity` abaixo de `reserved + committed`. Aumentar é permitido. Qualquer alteração pós-publicação deve atualizar `ticket_inventory.capacity` na mesma transação.

Essa regra não precisa ser implementada nesta tarefa (ainda não há endpoint de alteração pós-publicação). Registrar como pendência no relatório.

## Outbox

Criar somente quando necessário:
- `inventory.initialized.v1` — emitido na publicação do evento (dentro da transação de publicação)

## Testes obrigatórios

### Unitários (domínio)

- entidade com valores válidos;
- tentativa de construir com `reserved > capacity` — erro;
- `available` calculado corretamente.

### Integração (PostgreSQL real via Testcontainers)

- inicialização cria inventory para cada ticket type ativo ao publicar;
- `GET /availability` retorna capacidade inicial (sem reservas);
- `GET /availability` retorna 404 para evento não publicado;
- `GET /availability` retorna 404 para slug inexistente;
- constraint `CHECK` impede INSERT com `reserved > capacity`;
- constraint `CHECK` impede UPDATE que deixaria `available < 0`;
- UNIQUE constraint em `ticket_type_id`;
- isolamento por organização.

### Concorrência (PostgreSQL real)

**Teste crítico obrigatório:**
```
capacity = 10
requisição A: reservar 7
requisição B: reservar 7
→ uma vence (reserved = 7)
→ outra falha com INSUFFICIENT_INVENTORY
→ reserved final = 7, nunca 14
→ available final = 3, nunca negativo
```

Executar via `Promise.all` com 2 transações concorrentes contra PostgreSQL real.

### Migration

- migration aplica em banco limpo;
- rollback de migration não quebra dados existentes.

## Validações para concluir

```bash
pnpm lint
pnpm typecheck
pnpm test           # unitários
pnpm test:integration  # Testcontainers
pnpm build
```

## Formato de conclusão

Informar:
1. arquivos alterados;
2. comportamento implementado;
3. testes executados e resultados;
4. decisões tomadas;
5. riscos;
6. pendências;
7. documentação atualizada.
