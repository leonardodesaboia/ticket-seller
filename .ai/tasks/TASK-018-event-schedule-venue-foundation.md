# TASK-018 — Event Schedule and Venue Foundation

## Identificador

TASK-018

## Título

Event Schedule and Venue Foundation

## Objetivo

Adicionar campos de agenda (format, startsAt, endsAt, timezone, onlineInfo) e local (venueId, currency) ao model Event. Criar módulo `venues` com CreateVenue e ListOrganizationVenues. Adicionar endpoint `PATCH /configuration` no controller de events. Manter isolamento multi-tenant, controle de concorrência e transactional outbox.

## Status

COMPLETED

## Dependências

TASK-016 (UpdateEvent congelado), TASK-017 (backoffice congelado)

## Propriedade exclusiva

- `apps/api/prisma/migrations/20260729000003_event_schedule_venue/`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/venues/`
- `apps/api/src/modules/events/` (use case updateConfiguration, novos campos)
- `apps/api/src/app.module.ts`
- `apps/api/test/integration/events.integration-spec.ts` (configuração)
- `apps/api/test/integration/venues.integration-spec.ts` (novo)

## Arquivos proibidos

- `apps/backoffice-web/**` (aguarda TASK-020)
- `apps/marketplace-web/**`
- `packages/**`

## Resultado observável

- `POST /api/v1/organizations/:orgId/venues` cria venue
- `GET /api/v1/organizations/:orgId/venues` lista venues da org
- `PATCH /api/v1/organizations/:orgId/events/:eventId/configuration` atualiza campos de agenda e local
- Isolamento multi-tenant: venue de outra org não pode ser atribuído ao evento
- Timezone inválida retorna 422
- endsAt antes de startsAt retorna 422
- outbox: venue.created.v1, event.configuration-updated.v1

## Contratos produzidos (congelados para TASK-020)

```
POST /api/v1/organizations/:organizationId/venues
  Body: { name: string, address: string, city: string, state: string, country: string, postalCode?: string }
  Response: VenueResponse (201)
  Erros: 400, 401, 403, 404

GET /api/v1/organizations/:organizationId/venues
  Response: { data: VenueResponse[] }
  Erros: 400, 401, 404

PATCH /api/v1/organizations/:organizationId/events/:eventId/configuration
  Body: {
    expectedVersion: number,
    format?: 'IN_PERSON' | 'ONLINE' | 'HYBRID',
    startsAt?: string (ISO 8601),
    endsAt?: string (ISO 8601),
    timezone?: string (IANA),
    onlineInfo?: string | null,
    venueId?: string | null,
    currency?: string (ISO 4217, 3 chars)
  }
  Response: EventResponse (200)
  Erros: 400, 401, 403, 404, 409 (version conflict), 422 (not draft / invalid timezone / ends before starts / venue org mismatch)

EventResponse (atualizado):
  id, organizationId, title, description, status, version,
  format, startsAt, endsAt, timezone, venueId, currency,
  createdAt, updatedAt
  (onlineInfo NOT included — segurança)
```

## Critérios de aceite

- [ ] Migration 20260729000003_event_schedule_venue aplicada
- [ ] Venue domain entity com todos os campos
- [ ] CreateVenueUseCase: verifica membership + papel, cria venue + outbox venue.created.v1
- [ ] ListOrganizationVenuesUseCase: verifica membership ACTIVE (qualquer papel)
- [ ] IVenueRepository: create, findById, findByOrganization
- [ ] PrismaVenueRepository implementa IVenueRepository
- [ ] VenuesController: POST e GET com ParseUUIDPipe
- [ ] VenuesModule importado em AppModule
- [ ] IVenueAccessPort no domain de events
- [ ] PrismaVenueAccessAdapter em venues/infrastructure implementa IVenueAccessPort
- [ ] UpdateEventConfigurationUseCase: verifica membership, verifica DRAFT, verifica version, verifica venue (se informado), valida timezone via Intl, valida endsAt > startsAt, chama repository.updateConfiguration
- [ ] PrismaEventRepository.updateConfiguration: interactive $transaction, updateMany WHERE version=N AND status=DRAFT, outbox event.configuration-updated.v1
- [ ] EventResponse inclui format, startsAt, endsAt, timezone, venueId, currency (sem onlineInfo)
- [ ] 20+ testes de integração

## Formato de conclusão

Relatório em `.ai/reports/TASK-018-event-schedule-venue-foundation.md`
