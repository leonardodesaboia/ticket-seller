# TASK-019 — Ticket Types Foundation

## Identificador

TASK-019

## Título

Ticket Types Foundation

## Objetivo

Criar tipos de ingresso dentro do módulo events. Endpoints POST/GET/PATCH ticket-types. Idempotência no create via `Idempotency-Key` header. Deactivation via PATCH status=INACTIVE. Currency lock enforçado: não é possível alterar currency do evento após o primeiro ticket type ativo criado.

## Status

COMPLETED

## Dependências

TASK-018 (currency no evento congelado)

## Propriedade exclusiva

- `apps/api/prisma/migrations/20260729000004_ticket_types/`
- `apps/api/prisma/schema.prisma` (TicketType model)
- `apps/api/src/modules/events/domain/ticket-types/`
- `apps/api/src/modules/events/application/use-cases/ticket-types/`
- `apps/api/src/modules/events/infrastructure/repositories/prisma-ticket-type.repository.ts`
- `apps/api/src/modules/events/presentation/controllers/ticket-types.controller.ts`
- `apps/api/src/modules/events/presentation/dto/ticket-types/`
- `apps/api/test/integration/ticket-types.integration-spec.ts`

## Contratos produzidos (congelados para TASK-020)

```
POST /api/v1/organizations/:organizationId/events/:eventId/ticket-types
  Headers: Idempotency-Key (required)
  Body: { name: string, priceAmount: number (>=0), capacity: number (>0), description?: string | null }
  Response: TicketTypeResponse (201)
  Erros: 400, 401, 403, 404, 422 (sem currency, não DRAFT, sem Idempotency-Key)

GET /api/v1/organizations/:organizationId/events/:eventId/ticket-types
  Response: { data: TicketTypeResponse[] }
  Erros: 400, 401, 404

PATCH /api/v1/organizations/:organizationId/events/:eventId/ticket-types/:ticketTypeId
  Body: { expectedVersion, name?, description?, priceAmount?, capacity?, status? }
  Response: TicketTypeResponse (200)
  Erros: 400, 401, 403, 404, 409 (version conflict), 422 (não DRAFT)

TicketTypeResponse:
  id, eventId, organizationId, name, description, priceAmount, capacity, status, version, createdAt, updatedAt
  (currency NOT included — herdado do evento)
```

## Formato de conclusão

Relatório em `.ai/reports/TASK-019-ticket-types-foundation.md`
