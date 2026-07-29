# TASK-015 — ListOrganizationEvents

## Identificador

TASK-015

## Título

ListOrganizationEvents + ParseUUIDPipe

## Objetivo

Expor `GET /api/v1/organizations/:organizationId/events` com paginação por cursor (`createdAt DESC, id DESC`). Incluir correção do achado médio de auditoria: aplicar `ParseUUIDPipe` em todos os parâmetros UUID dos endpoints de events e organizations existentes e novos.

## Status

COMPLETED

## Dependências

TASK-013

## Propriedade exclusiva

- `apps/api/prisma/migrations/20260729000002_event_version/`
- `apps/api/src/modules/events/`
- `apps/api/test/integration/events.integration-spec.ts`

## Arquivos proibidos

- `apps/api/src/modules/organizations/**`
- `apps/api/src/platform/**`
- `apps/backoffice-web/**`
- `apps/marketplace-web/**`

## Resultado observável

`GET /api/v1/organizations/:organizationId/events?cursor=<base64>&limit=<n>` retorna `{ data: EventResponse[], nextCursor: string | null }`. UUID inválido em qualquer param retorna 400 RFC 9457. `EventResponse` inclui `version: number`.

## Contratos produzidos (congelados para TASK-017)

```
GET /api/v1/organizations/:organizationId/events
  Query: cursor?: string, limit?: number (default 20, max 100)
  Response: { data: EventResponse[], nextCursor: string | null }
  Erros: 400 (UUID inválido ou param inválido), 401, 404 (org não membro)

EventResponse:
  id, organizationId, title, description, status, version, createdAt, updatedAt
```

## Critérios de aceite

- [ ] Migration `20260729000002_event_version`: coluna `version INTEGER NOT NULL DEFAULT 1` em `events`
- [ ] `Event` entity inclui `version: number`
- [ ] `IEventRepository` inclui `findByOrganization(input): Promise<ListEventsResult>`
- [ ] `ListOrganizationEventsUseCase`: verifica membership ACTIVE (qualquer papel), delega ao repository
- [ ] Cursor encodeado em `base64url` de `<createdAt ISO>:<id>`
- [ ] Keyset pagination: `createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)`
- [ ] `ParseUUIDPipe({ version: '4' })` em `organizationId` e `eventId` em todos os endpoints de events
- [ ] UUID inválido retorna 400 RFC 9457
- [ ] `EventResponse` inclui campo `version`
- [ ] `ListEventsResponse` com `data` e `nextCursor`
- [ ] Testes unitários do use case
- [ ] Testes de integração: listagem, paginação, UUID inválido, isolamento por org

## Arquivos criados/modificados

- `apps/api/prisma/migrations/20260729000002_event_version/migration.sql` (novo)
- `apps/api/prisma/schema.prisma` (version no model Event)
- `apps/api/src/modules/events/domain/event.entity.ts` (version)
- `apps/api/src/modules/events/domain/event.errors.ts` (EventNotInDraftError, EventVersionConflictError)
- `apps/api/src/modules/events/domain/ports/event-repository.port.ts` (findByOrganization, UpdateEventInput, ListEventsInput, ListEventsResult)
- `apps/api/src/modules/events/application/use-cases/list-organization-events.use-case.ts` (novo)
- `apps/api/src/modules/events/application/use-cases/list-organization-events.use-case.spec.ts` (novo)
- `apps/api/src/modules/events/presentation/dto/event.response.ts` (version)
- `apps/api/src/modules/events/presentation/dto/list-events.response.ts` (novo)
- `apps/api/src/modules/events/presentation/events.controller.ts` (ParseUUIDPipe + GET list)
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event.repository.ts` (findByOrganization)
- `apps/api/src/modules/events/events.module.ts` (ListOrganizationEventsUseCase)
- `apps/api/test/integration/events.integration-spec.ts` (novos testes)

## Formato de conclusão

Relatório em `.ai/reports/TASK-015-list-organization-events.md`
