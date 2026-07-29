# Relatório TASK-015 — List Organization Events

## Status

COMPLETED

## O que foi feito

- `IEventRepository` estendida com `findByOrganization(input: ListEventsInput): Promise<ListEventsResult>`
- `PrismaEventRepository.findByOrganization`: paginação keyset com cursor `base64url(createdAt ISO|id)`, ordenação `createdAt DESC, id DESC`
- `ListOrganizationEventsUseCase`: valida membership ativo, cap de 100 itens por página
- `ListEventsResponse` DTO com `{ data: EventResponse[], nextCursor: string | null }`
- Endpoint `GET /api/v1/organizations/:organizationId/events?cursor=&limit=`
- `ParseUUIDPipe({ version: '4' })` adicionado em todos os parâmetros `organizationId` e `eventId` (endpoints existentes e novos)
- 6 testes unitários para `ListOrganizationEventsUseCase`
- Integração (`organizations.integration-spec.ts`) corrigida para usar `FastifyAdapter`
- Testes de integração: list com nextCursor, paginação com cursor, UUID inválido (400), sem membership (404), sem header (401)

## Arquivos modificados

- `apps/api/src/modules/events/domain/ports/event-repository.port.ts`
- `apps/api/src/modules/events/infrastructure/repositories/prisma-event.repository.ts`
- `apps/api/src/modules/events/application/use-cases/list-organization-events.use-case.ts` (novo)
- `apps/api/src/modules/events/application/use-cases/list-organization-events.use-case.spec.ts` (novo)
- `apps/api/src/modules/events/presentation/dto/list-events.response.ts` (novo)
- `apps/api/src/modules/events/presentation/events.controller.ts`
- `apps/api/src/modules/events/events.module.ts`
- `apps/api/test/integration/events.integration-spec.ts`
- `apps/api/test/integration/organizations.integration-spec.ts`

## Resultados de validação

- 41/41 testes unitários passando
- 41/41 testes de integração passando
- Typecheck, lint, build: OK
