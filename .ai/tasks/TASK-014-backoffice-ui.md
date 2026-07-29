# TASK-014 — Backoffice UI

## Identificador

TASK-014

## Título

Backoffice UI — Organizations e Events

## Objetivo

Implementar a primeira fatia funcional de UI no backoffice: formulários de criação de organização e evento, e página de detalhe do evento. Conectar com a API via TanStack Query.

## Status

COMPLETED

## Dependências

TASK-012, TASK-013

## Propriedade exclusiva

- `apps/backoffice-web/src/app/providers.tsx`
- `apps/backoffice-web/src/app/organizations/`
- `apps/backoffice-web/src/features/organizations/`
- `apps/backoffice-web/src/features/events/`

## Arquivos proibidos

- `apps/api/**`
- `apps/marketplace-web/**`
- `packages/**`

## Resultado observável

O backoffice exibe formulário em `/organizations/new`, formulário de evento em `/organizations/[id]/events/new` e detalhe do evento em `/organizations/[id]/events/[eventId]`. Todas as chamadas à API usam `X-Dev-User-Id` lido de `NEXT_PUBLIC_DEV_USER_ID`.

## Critérios de aceite

- [ ] `providers.tsx` com `QueryClientProvider` (`'use client'`)
- [ ] Feature `organizations`: types, schema Zod, api, hook `useCreateOrganization`, `CreateOrganizationForm`
- [ ] Feature `events`: types, schema Zod, api, hooks `useCreateEvent` e `useGetEvent`, `CreateEventForm`, `EventDetail`
- [ ] Página `/organizations/new`
- [ ] Página `/organizations/[organizationId]/events/new`
- [ ] Página `/organizations/[organizationId]/events/[eventId]`
- [ ] Validação via React Hook Form + zodResolver
- [ ] `X-Dev-User-Id` lido de `process.env['NEXT_PUBLIC_DEV_USER_ID']` — nunca hardcoded
- [ ] Typecheck limpo (`exactOptionalPropertyTypes: true`)
- [ ] Prettier e ESLint limpos

## Arquivos criados

- `apps/backoffice-web/src/app/providers.tsx`
- `apps/backoffice-web/src/app/organizations/new/page.tsx`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/new/page.tsx`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/page.tsx`
- `apps/backoffice-web/src/features/organizations/types.ts`
- `apps/backoffice-web/src/features/organizations/schemas.ts`
- `apps/backoffice-web/src/features/organizations/api.ts`
- `apps/backoffice-web/src/features/organizations/hooks.ts`
- `apps/backoffice-web/src/features/organizations/components/CreateOrganizationForm.tsx`
- `apps/backoffice-web/src/features/events/types.ts`
- `apps/backoffice-web/src/features/events/schemas.ts`
- `apps/backoffice-web/src/features/events/api.ts`
- `apps/backoffice-web/src/features/events/hooks.ts`
- `apps/backoffice-web/src/features/events/components/CreateEventForm.tsx`
- `apps/backoffice-web/src/features/events/components/EventDetail.tsx`
- `.ai/tasks/TASK-014-backoffice-ui.md`
- `.ai/reports/TASK-014-backoffice-ui.md`

## Documentação atualizada

- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_MAP.md`

## Formato de conclusão

Relatório em `.ai/reports/TASK-014-backoffice-ui.md`
