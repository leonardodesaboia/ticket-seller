# TASK-012 — CreateOrganization

## Identificador

TASK-012

## Título

CreateOrganization

## Objetivo

Implementar o primeiro endpoint funcional da API: `POST /api/v1/organizations`. Módulo hexagonal completo para criação de organizações com criação atômica via outbox transacional.

## Status

COMPLETED

## Dependências

TASK-011

## Propriedade exclusiva

- `apps/api/src/modules/organizations/`
- `apps/api/test/integration/organizations.integration-spec.ts`

## Arquivos proibidos

- `apps/api/prisma/migrations/**`
- `apps/api/src/platform/**`
- `apps/backoffice-web/**`
- `apps/marketplace-web/**`

## Resultado observável

`POST /api/v1/organizations` com header `X-Dev-User-Id` e body `{ name, slug }` retorna 201 com a organização criada. O criador é automaticamente membro OWNER ACTIVE. Um evento `organization.created.v1` é escrito no outbox na mesma transação.

## Critérios de aceite

- [ ] Entidade `Organization` no domínio
- [ ] `SlugAlreadyInUseError` no domínio
- [ ] `IOrganizationRepository` com `create` e `existsBySlug`
- [ ] `CreateOrganizationUseCase` valida slug (padrão `^[a-z0-9]+(?:-[a-z0-9]+)*$`)
- [ ] `PrismaOrganizationRepository` usa `$transaction` atômico (org + member OWNER + outbox)
- [ ] `CreateOrganizationDto` com class-validator
- [ ] `OrganizationsController` mapeado em `organizations`, protegido por `ActorGuard`
- [ ] `OrganizationsModule` importa `HttpModule`
- [ ] `OrganizationsModule` registrado em `AppModule`
- [ ] POST `/api/v1/organizations` retorna 201
- [ ] Retorna 409 para slug duplicado
- [ ] Retorna 401 sem header `X-Dev-User-Id`
- [ ] Retorna 400 para body inválido
- [ ] 6 testes de integração passando via Testcontainers

## Arquivos criados

- `apps/api/src/modules/organizations/domain/organization.entity.ts`
- `apps/api/src/modules/organizations/domain/organization.errors.ts`
- `apps/api/src/modules/organizations/domain/ports/organization-repository.port.ts`
- `apps/api/src/modules/organizations/application/use-cases/create-organization.use-case.ts`
- `apps/api/src/modules/organizations/application/use-cases/create-organization.use-case.spec.ts`
- `apps/api/src/modules/organizations/infrastructure/repositories/prisma-organization.repository.ts`
- `apps/api/src/modules/organizations/presentation/dto/create-organization.dto.ts`
- `apps/api/src/modules/organizations/presentation/dto/organization.response.ts`
- `apps/api/src/modules/organizations/presentation/organizations.controller.ts`
- `apps/api/src/modules/organizations/organizations.module.ts`
- `apps/api/test/integration/organizations.integration-spec.ts`
- `.ai/tasks/TASK-012-create-organization.md`
- `.ai/reports/TASK-012-create-organization.md`

## Documentação atualizada

- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

## Formato de conclusão

Relatório em `.ai/reports/TASK-012-create-organization.md`
