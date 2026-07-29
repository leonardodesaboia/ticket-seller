# Relatório TASK-019 — Ticket Types Foundation

## Status

COMPLETED

## O que foi implementado

### Database
- Migration `20260729000004_ticket_types`: tabela `ticket_types` com CHECK constraints (price_amount >= 0, capacity > 0), FK para events e organizations
- Schema Prisma atualizado com model `TicketType` e relações inversas em `Event` e `Organization`

### Domínio (dentro de events/domain/ticket-types/)
- `TicketType` entity: id, eventId, organizationId, name, description, priceAmount, capacity, status, version, createdAt, updatedAt
- `ticket-type.errors.ts`: TicketTypeNotFoundError, TicketTypeVersionConflictError, EventCurrencyNotSetError, EventCurrencyLockedError, TicketTypeNotBelongToEventError
- `ITicketTypeRepository` port: create, findByEventAndId, findByEvent, update, countActiveByEvent

### Application
- `CreateTicketTypeUseCase`: verifica membership + papel, verifica DRAFT, verifica currency set, idempotência via IdempotencyRecord (scoped key), cria ticket type
- `ListEventTicketTypesUseCase`: verifica membership (qualquer papel), verifica evento existe
- `UpdateTicketTypeUseCase`: verifica membership + papel, verifica DRAFT, verifica version, suporta deactivation via status=INACTIVE

### Infrastructure
- `PrismaTicketTypeRepository`: create + outbox `ticket-type.created.v1`, findByEventAndId, findByEvent ordenado por createdAt ASC, update via updateMany + outbox (`ticket-type.updated.v1` ou `ticket-type.deactivated.v1`), countActiveByEvent

### Presentation
- `TicketTypesController` em `organizations/:orgId/events/:eventId/ticket-types`
- POST, GET, PATCH :ticketTypeId com ParseUUIDPipe

### Currency lock
- `UpdateEventConfigurationUseCase` atualizado: se currency diferente do atual, verifica `countActiveByEvent > 0` → EventCurrencyLockedError (422)

### Testes
- `create-ticket-type.use-case.spec.ts` — 7 testes unitários
- `update-ticket-type.use-case.spec.ts` — 8 testes unitários
- `update-event-configuration.use-case.spec.ts` — +2 testes (currency lock)
- `ticket-types.integration-spec.ts` — 27 testes de integração
- Total: 98 integração + 72 unitários, todos passando

## Segurança
- Currency herdado do evento, não incluído no TicketTypeResponse
- Idempotência scoped por organizationId:eventId:key (evita colisão cross-org)
- Isolamento multi-tenant via organizationId em todos os filtros
- Controle de concorrência: version + updateMany
