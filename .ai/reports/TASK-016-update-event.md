# Relatório TASK-016 — Update Event

## Status

COMPLETED

## O que foi feito

- Migração `20260729000002_event_version`: coluna `version INTEGER NOT NULL DEFAULT 1` na tabela `events`
- `Event` entity e Prisma schema atualizados com campo `version`
- `EventNotInDraftError` e `EventVersionConflictError` adicionados em `event.errors.ts`
- `UpdateEventInput` adicionado ao port `IEventRepository`
- `PrismaEventRepository.update`: transação interativa com `updateMany WHERE version = expectedVersion AND status = DRAFT`; count=0 → `EventVersionConflictError`; escreve `event.updated.v1` no outbox com `changedFields`, `version`, `occurredAt`
- `UpdateEventUseCase`: valida membership, role (`EVENT_CREATOR_ROLES`), status=DRAFT, versão; pré-checagem rápida antes da operação atômica no repositório
- `UpdateEventDto`: `title?`, `description?`, `version` (obrigatório, int positivo)
- `EventResponse` atualizada com campo `version`
- Endpoint `PATCH /api/v1/organizations/:organizationId/events/:eventId`
  - 200: update bem-sucedido
  - 409: conflito de versão (RFC 9457)
  - 422: evento não está em DRAFT (RFC 9457)
  - 403: role insuficiente
  - 404: não encontrado / sem acesso
- 7 testes unitários para `UpdateEventUseCase`
- Testes de integração: update com version 2, outbox escrito, 409 conflito, 422 não-DRAFT, 403 VIEWER, UUID inválido (400), sem membership (404)

## Arquivos modificados

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260729000002_event_version/migration.sql` (novo)
- `apps/api/src/modules/events/domain/event.entity.ts`
- `apps/api/src/modules/events/domain/event.errors.ts`
- `apps/api/src/modules/events/domain/ports/event-repository.port.ts`
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event.repository.ts`
- `apps/api/src/modules/events/application/use-cases/update-event.use-case.ts` (novo)
- `apps/api/src/modules/events/application/use-cases/update-event.use-case.spec.ts` (novo)
- `apps/api/src/modules/events/presentation/dto/update-event.dto.ts` (novo)
- `apps/api/src/modules/events/presentation/dto/event.response.ts`
- `apps/api/src/modules/events/presentation/events.controller.ts`
- `apps/api/src/modules/events/events.module.ts`
- `apps/api/test/integration/events.integration-spec.ts`

## Resultados de validação

- 41/41 testes unitários passando
- 41/41 testes de integração passando
- Typecheck, lint, build: OK
