# TASK-016 — UpdateEvent

## Identificador

TASK-016

## Título

UpdateEvent com controle de concorrência por versão

## Objetivo

Expor `PATCH /api/v1/organizations/:organizationId/events/:eventId` para edição de `title` e `description` de eventos em DRAFT. Controle de concorrência via coluna `version` (optimistic locking). Outbox atômico `event.updated.v1`.

## Status

COMPLETED

## Dependências

TASK-015 (migration de version já aplicada)

## Propriedade exclusiva

- `apps/api/src/modules/events/`
- `apps/api/test/integration/events.integration-spec.ts`

## Arquivos proibidos

- `apps/api/prisma/migrations/**`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/organizations/**`
- `apps/api/src/platform/**`
- `apps/backoffice-web/**`

## Resultado observável

`PATCH /api/v1/organizations/:orgId/events/:eventId` com `{ title?, description?, version }` atualiza o evento e retorna 200 com `EventResponse` (version incrementada). Versão errada retorna 409 RFC 9457. Evento fora de DRAFT retorna 422 RFC 9457.

## Contratos produzidos (congelados para TASK-017)

```
PATCH /api/v1/organizations/:organizationId/events/:eventId
  Body: { title?: string, description?: string | null, version: number }
  Response: EventResponse (200)
  Erros: 400 (UUID inválido, body inválido), 401, 403 (papel insuficiente),
         404 (não membro / evento não encontrado), 409 (versão divergente),
         422 (evento não está em DRAFT)
```

## Critérios de aceite

- [ ] `EventNotInDraftError` e `EventVersionConflictError` no domínio
- [ ] `IEventRepository.update(input): Promise<Event>`
- [ ] `UpdateEventUseCase`: verifica membership ACTIVE + papel em EVENT_CREATOR_ROLES, busca evento, verifica DRAFT, verifica version, chama repository.update
- [ ] `PrismaEventRepository.update`: interactive `$transaction`, `updateMany` com WHERE version + status = DRAFT, throw `EventVersionConflictError` se count=0, write outbox `event.updated.v1` com changedFields e nova version
- [ ] `UpdateEventDto`: `title?: string`, `description?: string | null`, `version: number` (required, int, min 1)
- [ ] `ParseUUIDPipe` em `organizationId` e `eventId` no PATCH
- [ ] 200 com EventResponse atualizado (version incrementada)
- [ ] 409 para version divergente
- [ ] 422 para evento não em DRAFT
- [ ] Testes unitários do use case (8+ casos)
- [ ] Testes de integração: update success, 409 conflict, 422 not draft, 403 viewer, UUID inválido, outbox escrito

## Arquivos criados/modificados

- `apps/api/src/modules/events/domain/event.errors.ts` (EventNotInDraftError, EventVersionConflictError)
- `apps/api/src/modules/events/domain/ports/event-repository.port.ts` (UpdateEventInput, update method)
- `apps/api/src/modules/events/application/use-cases/update-event.use-case.ts` (novo)
- `apps/api/src/modules/events/application/use-cases/update-event.use-case.spec.ts` (novo)
- `apps/api/src/modules/events/presentation/dto/update-event.dto.ts` (novo)
- `apps/api/src/modules/events/presentation/events.controller.ts` (PATCH endpoint)
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event.repository.ts` (update method)
- `apps/api/src/modules/events/events.module.ts` (UpdateEventUseCase)
- `apps/api/test/integration/events.integration-spec.ts` (novos testes)

## Formato de conclusão

Relatório em `.ai/reports/TASK-016-update-event.md`
