# TASK-013 — CreateEvent + GetEvent

## Identificador

TASK-013

## Título

CreateEvent + GetEvent

## Objetivo

Implementar criação e consulta de eventos: `POST /api/v1/organizations/:organizationId/events` e `GET /api/v1/organizations/:organizationId/events/:eventId`. Módulo hexagonal completo com verificação de papel e escrita atômica no outbox.

## Status

COMPLETED

## Dependências

TASK-011, TASK-012

## Propriedade exclusiva

- `apps/api/prisma/migrations/20260729000001_events/`
- `apps/api/src/modules/events/`
- `apps/api/test/integration/events.integration-spec.ts`

## Arquivos proibidos

- `apps/api/src/modules/organizations/**`
- `apps/api/src/platform/**`
- `apps/backoffice-web/**`
- `apps/marketplace-web/**`

## Resultado observável

`POST /api/v1/organizations/:organizationId/events` cria o evento como DRAFT e escreve `event.created.v1` no outbox. `GET /api/v1/organizations/:organizationId/events/:eventId` retorna o evento. Ambos exigem `X-Dev-User-Id` e membership ACTIVE na organização. Criação exige papel OWNER, ADMIN ou EVENT_MANAGER.

## Critérios de aceite

- [ ] Migration `20260729000001_events` cria tabela `events` com FK para `organizations`
- [ ] Entidade `Event` no domínio
- [ ] `EventNotFoundError`, `OrganizationAccessDeniedError`, `InsufficientRoleError` no domínio
- [ ] `IEventRepository` com `create` e `findByOrganizationAndId`
- [ ] `IOrganizationAccessPort` como porta de domínio (sem importar módulo organizations)
- [ ] `EVENT_CREATOR_ROLES = ['OWNER', 'ADMIN', 'EVENT_MANAGER']`
- [ ] `CreateEventUseCase` verifica membership ACTIVE e papel antes de criar
- [ ] `GetEventUseCase` verifica membership ACTIVE (qualquer papel) antes de retornar
- [ ] `PrismaEventRepository.create` usa `$transaction` atômico (event + outbox `event.created.v1`)
- [ ] `PrismaOrganizationAccessAdapter` consulta `organizationMember` por `(organizationId, userId)`
- [ ] `EventsController` mapeado em `organizations/:organizationId/events`, protegido por `ActorGuard`
- [ ] POST retorna 201, GET retorna 200
- [ ] POST retorna 404 quando ator não é membro
- [ ] POST retorna 403 quando papel insuficiente (ex.: VIEWER)
- [ ] GET retorna 404 quando evento não existe ou pertence a outra organização
- [ ] Retorna 401 sem header `X-Dev-User-Id`
- [ ] `EventsModule` registrado em `AppModule`
- [ ] Testes unitários dos dois casos de uso (11 testes)
- [ ] Testes de integração via Testcontainers (12 testes, incluindo outbox)

## Arquivos criados

- `apps/api/prisma/migrations/20260729000001_events/migration.sql`
- `apps/api/src/modules/events/domain/event.entity.ts`
- `apps/api/src/modules/events/domain/event.errors.ts`
- `apps/api/src/modules/events/domain/ports/event-repository.port.ts`
- `apps/api/src/modules/events/domain/ports/organization-access.port.ts`
- `apps/api/src/modules/events/application/use-cases/create-event.use-case.ts`
- `apps/api/src/modules/events/application/use-cases/create-event.use-case.spec.ts`
- `apps/api/src/modules/events/application/use-cases/get-event.use-case.ts`
- `apps/api/src/modules/events/application/use-cases/get-event.use-case.spec.ts`
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event.repository.ts`
- `apps/api/src/modules/events/infrastructure/adapters/prisma-organization-access.adapter.ts`
- `apps/api/src/modules/events/presentation/dto/create-event.dto.ts`
- `apps/api/src/modules/events/presentation/dto/event.response.ts`
- `apps/api/src/modules/events/presentation/events.controller.ts`
- `apps/api/src/modules/events/events.module.ts`
- `apps/api/test/integration/events.integration-spec.ts`
- `.ai/tasks/TASK-013-create-get-event.md`
- `.ai/reports/TASK-013-create-get-event.md`

## Documentação atualizada

- `apps/api/prisma/schema.prisma` (model Event adicionado)
- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

## Formato de conclusão

Relatório em `.ai/reports/TASK-013-create-get-event.md`
