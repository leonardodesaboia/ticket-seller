# TASK-011 — Actor Foundation

## Identificador

TASK-011

## Título

Actor Foundation

## Objetivo

Estabelecer a infraestrutura de identificação do ator nas requisições HTTP: porta `IActorAdapter`, implementação de desenvolvimento `DevelopmentActorAdapter`, `ActorGuard` e decorator `@CurrentActor()`.

## Status

COMPLETED

## Dependências

TASK-010

## Propriedade exclusiva

- `apps/api/src/platform/http/actor-adapter.port.ts`
- `apps/api/src/platform/http/adapters/development-actor.adapter.ts`
- `apps/api/src/platform/http/guards/actor.guard.ts`
- `apps/api/src/platform/http/http.module.ts`
- `apps/api/src/shared/kernel/actor.types.ts`
- `apps/api/src/shared/kernel/current-actor.decorator.ts`

## Arquivos proibidos

- `apps/api/prisma/**`
- `apps/api/src/modules/**`

## Resultado observável

Qualquer endpoint protegido por `ActorGuard` retorna 401 quando o header `X-Dev-User-Id` está ausente e injeta o ator na requisição quando presente.

## Critérios de aceite

- [ ] `IActorAdapter` definido como porta com Symbol `ACTOR_ADAPTER`
- [ ] `DevelopmentActorAdapter` lê header `X-Dev-User-Id`
- [ ] `DevelopmentActorAdapter` retorna `null` em `NODE_ENV=production`
- [ ] `ActorGuard` lança `UnauthorizedException` quando `resolve()` retorna `null`
- [ ] `ActorGuard` anexa o ator em `request['actor']`
- [ ] `@CurrentActor()` extrai `ICurrentActor` de `request['actor']`
- [ ] `HttpModule` exporta `ActorGuard` e `ACTOR_ADAPTER`
- [ ] Nenhum módulo de negócio criado nesta tarefa

## Arquivos criados

- `apps/api/src/platform/http/actor-adapter.port.ts`
- `apps/api/src/platform/http/adapters/development-actor.adapter.ts`
- `apps/api/src/platform/http/guards/actor.guard.ts`
- `apps/api/src/platform/http/http.module.ts`
- `apps/api/src/shared/kernel/actor.types.ts`
- `apps/api/src/shared/kernel/current-actor.decorator.ts`
- `.ai/tasks/TASK-011-actor-foundation.md`
- `.ai/reports/TASK-011-actor-foundation.md`

## Documentação atualizada

- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

## Formato de conclusão

Relatório em `.ai/reports/TASK-011-actor-foundation.md`
