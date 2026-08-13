# Relatório da TASK-025 — Inventory Foundation

## Status

MERGED em develop (revisão de código aplicada antes do merge; 13 testes unitários + 28 testes de integração, incluindo 2 de concorrência).

## Arquivos alterados

### Banco de dados
- `apps/api/prisma/schema.prisma` — modelo `TicketInventory` adicionado.
- `apps/api/prisma/migrations/20260811000006_ticket_inventory/migration.sql` — tabela `ticket_inventory` com constraints de integridade.
- `apps/api/prisma/migrations/20260811000007_ticket_inventory_constraints/migration.sql` — constraint `capacity > 0` e FK para `organizations` adicionadas em migration separada.

### Módulo inventory (novo)
- `apps/api/src/modules/inventory/domain/ticket-inventory.entity.ts` — entidade com getter `available` e invariantes no construtor.
- `apps/api/src/modules/inventory/domain/ticket-inventory.entity.spec.ts` — 13 testes unitários de domínio.
- `apps/api/src/modules/inventory/domain/inventory.errors.ts` — `InsufficientInventoryError`.
- `apps/api/src/modules/inventory/domain/ports/inventory-repository.port.ts` — porta do repositório.
- `apps/api/src/modules/inventory/application/use-cases/get-availability.use-case.ts` — caso de uso de consulta de disponibilidade.
- `apps/api/src/modules/inventory/infrastructure/repositories/prisma-inventory.repository.ts` — repositório com SQL atômico para `tryReserve` e cálculo lazy de disponibilidade via JOIN.
- `apps/api/src/modules/inventory/presentation/controllers/public-availability.controller.ts` — controller do endpoint público.
- `apps/api/src/modules/inventory/presentation/dto/availability.response.ts` — DTO de resposta.
- `apps/api/src/modules/inventory/inventory.module.ts` — composição do módulo.

### Módulo events (evolução)
- `apps/api/src/modules/events/presentation/dto/public-event.response.ts` — `ticketTypeId: string` adicionado a `PublicTicketTypeResponse`.
- `apps/api/src/modules/events/presentation/controllers/public-events.controller.ts` — endpoint de availability registrado.
- `apps/api/src/modules/events/application/use-cases/publish-event.use-case.ts` — inicialização do inventory chamada na publicação do evento via `PublishEventOperationPort`.

### Testes de integração (novos)
- `apps/api/test/integration/inventory/prisma-inventory.repository.integration-spec.ts` — 23 testes cobrindo inicialização, disponibilidade, isolamento de tenant, constraints e `tryReserve`.
- `apps/api/test/integration/inventory/prisma-inventory.concurrent.integration-spec.ts` — 2 testes de concorrência com PostgreSQL real.
- `apps/api/test/integration/inventory/public-availability.controller.integration-spec.ts` — 3 testes de contrato do endpoint HTTP.

## Comportamento implementado

- Publicar um evento inicializa um `ticket_inventory` para cada `TicketType` com `status = 'ACTIVE'`, dentro da mesma transação da publicação.
- `GET /api/v1/public/events/:slug/availability` retorna `availableQuantity` por ticket type, calculado via JOIN lazy com `reservation_items` (reservas ativas e não expiradas não bloqueiam estoque se expiradas, sem necessidade de worker de limpeza).
- Endpoint retorna 404 para eventos não publicados ou slugs inexistentes.
- Resposta inclui `Cache-Control: public, max-age=10, stale-while-revalidate=30`.
- `tryReserve` usa UPDATE atômico com condição de suficiência: 0 rows → `InsufficientInventoryError`, sem risco de overselling.
- `ticketTypeId` exposto no contrato público do evento, necessário para TASK-026 e TASK-028.

## Decisões tomadas

- Duas migrations separadas: a primeira cria a tabela; a segunda adiciona `capacity > 0` e a FK para `organizations`, mantida em migration independente para rastreabilidade de evolução incremental.
- A disponibilidade usa cálculo lazy via JOIN (não `ticket_inventory.reserved` diretamente), garantindo corretude sem worker de expiração. A coluna `reserved` permanece para operações de reserva (TASK-026).
- O endpoint de availability foi registrado no controller do módulo `inventory`, não no de `events`, preservando separação de responsabilidades.
- Use cases `try-reserve-inventory` e `release-inventory-hold` foram deixados para TASK-026, conforme definido na task.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm typecheck` | Aprovado (3 pacotes) |
| `pnpm lint` | Aprovado (3 pacotes) |
| `pnpm test` | Aprovado (25 suítes, 150 testes unitários) |
| `pnpm --filter @ticket-seller/api test:integration` | Aprovado (13 suítes, 188 testes de integração) |
| `pnpm build` | Aprovado (3 pacotes) |

### Testes unitários de domínio (13)

- `available` calculado corretamente em todos os cenários.
- Construtor rejeita `capacity ≤ 0`, `reserved < 0`, `committed < 0`, `reserved > capacity`, `reserved + committed > capacity`.
- Aceita `reserved + committed = capacity` (borda).

### Testes de integração (28)

**Repositório (23):**
- Inicialização cria linha por ticket type; é idempotente (ON CONFLICT DO NOTHING).
- Disponibilidade retorna `capacity - committed` no estado inicial.
- Isolamento de tenant: organizações distintas não veem inventory uma da outra.
- Constraints CHECK rejeitam `reserved + committed > capacity`.
- UNIQUE constraint em `ticket_type_id`.
- `tryReserve` incrementa `reserved` quando há disponibilidade.
- `tryReserve` lança `InsufficientInventoryError` quando insuficiente.

**Concorrência (2):**
- Duas requisições simultâneas acima da capacidade: exatamente uma vence, outra falha com `InsufficientInventoryError`; `reserved` nunca ultrapassa `capacity`.
- Múltiplas reservas simultâneas que juntas cabem na capacidade: todas vencem.

**Controller (3):**
- 200 com items de disponibilidade para evento publicado.
- 404 para slug inexistente.
- 404 para evento em draft.

## Riscos identificados

- A coluna `reserved` em `ticket_inventory` representa reservas ativas confirmadas pelo SQL atômico de TASK-026. Até TASK-026 ser integrada, `reserved` permanece `0` e `available = capacity - committed`. Não há risco de inconsistência no estado atual.
- O cálculo lazy via JOIN pode ter performance degradada em eventos com muitas reservas ativas simultâneas. Para o MVP (até 100 usuários), o impacto é desprezível. Índices em `reservation_items.ticket_type_id` e `reservations.status, expires_at` devem ser criados em TASK-026.

## Pendências

- Regra de alteração de capacidade pós-publicação (redução proibida abaixo de `reserved + committed`) não implementada: ainda não há endpoint de alteração pós-publicação. Registrado como pendência futura.
- Use cases `try-reserve-inventory` e `release-inventory-hold` são implementados em TASK-026.
- Worker de limpeza de reservas expiradas é fora do escopo desta task.

## Documentação atualizada

- `.ai/tasks/TASK-025-inventory-foundation.md` — status atualizado para CONCLUÍDA.
- Este relatório.
- Documentação de módulo não criada: será adicionada em task específica de documentação ou junto à estabilização da fase de reservas/pedidos.

## Próxima tarefa recomendada

TASK-026 — Reservation Holds (já integrada em develop).
