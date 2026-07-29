# Relatório TASK-018 — Event Schedule and Venue Foundation

## Status

COMPLETED

## O que foi implementado

### Database (Database Owner)
- Migration `20260729000003_event_schedule_venue`: cria tabela `venues` e adiciona colunas `format`, `starts_at`, `ends_at`, `timezone`, `online_info`, `venue_id`, `currency` à tabela `events`
- CHECK constraints: `format IN ('IN_PERSON', 'ONLINE', 'HYBRID')` e `ends_at > starts_at` (quando ambos not null)
- FK: `events.venue_id → venues.id ON DELETE SET NULL`
- Schema Prisma atualizado com model `Venue` e campos no model `Event`

### Backend — módulo venues
- `venue.entity.ts` — entidade com id, organizationId, name, address, city, state, country, postalCode
- `venue.errors.ts` — VenueNotFoundError
- `venue-repository.port.ts` — IVenueRepository (create, findByOrganization)
- `PrismaVenueRepository` — create e findByOrganization ordenado por nome
- `CreateVenueUseCase` — verifica ACTIVE membership e EVENT_CREATOR_ROLES, cria venue
- `ListOrganizationVenuesUseCase` — verifica ACTIVE membership (qualquer papel)
- `VenuesController` — POST e GET com ParseUUIDPipe
- `VenuesModule` — fornece VENUE_ACCESS_PORT exportado para EventsModule

### Backend — port de acesso cross-módulo
- `venue-access.port.ts` — IVenueAccessPort com findVenue(venueId): Promise<VenueInfo | null>
- `PrismaVenueAccessAdapter` — implementa port consultando prisma.venue

### Backend — módulo events atualizado
- `Event` entity — novos campos: format, startsAt, endsAt, timezone, onlineInfo, venueId, currency
- `event.errors.ts` — EventVenueNotFoundError, EventVenueOrganizationMismatchError, InvalidTimezoneError, InvalidDateRangeError
- `event-repository.port.ts` — UpdateEventConfigurationInput e updateConfiguration() no IEventRepository
- `UpdateEventConfigurationUseCase` — verifica membership, DRAFT, version, timezone IANA, date range, venue org isolation; chama repository.updateConfiguration
- `PrismaEventRepository.updateConfiguration` — interactive $transaction, updateMany WHERE version+status, outbox `event.configuration-updated.v1`
- `PrismaEventRepository.toEntity` — atualizado para incluir todos os novos campos
- `EventResponse` — novos campos: format, startsAt, endsAt, timezone, venueId, currency (`onlineInfo` excluído por segurança)
- `UpdateEventConfigurationDto` — validação de todos os campos opcionais
- `EventsController` — endpoint PATCH :eventId/configuration
- `EventsModule` — importa VenuesModule, adiciona UpdateEventConfigurationUseCase

### AppModule
- Importa VenuesModule

### Testes
- `update-event-configuration.use-case.spec.ts` — 13 testes unitários
- `events.integration-spec.ts` — 16 testes adicionados (configuração)
- `venues.integration-spec.ts` — 13 testes de integração (POST + GET)
- Todos os spec files de events atualizados com novos campos da entidade e `updateConfiguration` no mock

## Totais
- 55 testes unitários passando
- 70 testes de integração passando
- Typecheck limpo, lint limpo, build limpo

## Segurança
- `onlineInfo` não incluído no EventResponse (conforme restrição do plano)
- `onlineInfo` não logado (campo interno apenas)
- Isolamento multi-tenant: venue de outra org retorna 422
- Controle de concorrência preservado (version + optimistic lock)
- Transactional outbox atômico com cada operação
