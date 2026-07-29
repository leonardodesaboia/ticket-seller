# TASK-017 — Event Management Backoffice

## Identificador

TASK-017

## Título

Event Management Backoffice

## Objetivo

Implementar no backoffice: listagem paginada de eventos da organização e formulário de edição de evento (apenas DRAFT). Consome contratos congelados de TASK-015 e TASK-016.

## Status

COMPLETED

## Dependências

TASK-015 (contrato de listagem congelado), TASK-016 (contrato de update congelado)

## Propriedade exclusiva

- `apps/backoffice-web/src/features/events/`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/page.tsx`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/edit/`

## Arquivos proibidos

- `apps/api/**`
- `apps/marketplace-web/**`
- `packages/**`

## Resultado observável

- `/organizations/[id]/events` lista eventos com paginação "carregar mais"
- `/organizations/[id]/events/[eventId]/edit` exibe formulário de edição do evento; versão gerenciada automaticamente; 409 exibe mensagem de conflito
- Build passa sem erros

## Critérios de aceite

- [ ] Tipo `Event` inclui `version: number`
- [ ] `ListEventsResponse: { data: Event[], nextCursor: string | null }`
- [ ] `listEvents(orgId, params, devUserId)` na api
- [ ] `updateEvent(orgId, eventId, data, devUserId)` na api
- [ ] `useListEvents(orgId)`: useQuery com cursor state
- [ ] `useUpdateEvent(orgId, eventId)`: useMutation
- [ ] Schema Zod de update: `title` (string, min 1, max 500), `description` (string | null, opcional), `version` (number int positivo)
- [ ] `EventList`: lista de cards com title, status, version, link para editar
- [ ] `EditEventForm`: campos title e description, versão oculta, disable durante submit, erro de conflito específico
- [ ] Página `/organizations/[orgId]/events` com EventList + botão "Carregar mais"
- [ ] Página `/organizations/[orgId]/events/[eventId]/edit`
- [ ] Typecheck limpo, Prettier limpo, build OK

## Arquivos criados/modificados

- `apps/backoffice-web/src/features/events/types/index.ts` (version field)
- `apps/backoffice-web/src/features/events/schemas/index.ts` (update schema)
- `apps/backoffice-web/src/features/events/api/events.api.ts` (listEvents, updateEvent)
- `apps/backoffice-web/src/features/events/hooks/use-list-events.ts` (novo)
- `apps/backoffice-web/src/features/events/hooks/use-update-event.ts` (novo)
- `apps/backoffice-web/src/features/events/components/EventList.tsx` (novo)
- `apps/backoffice-web/src/features/events/components/EditEventForm.tsx` (novo)
- `apps/backoffice-web/src/features/events/index.ts` (exports)
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/page.tsx` (novo)
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/edit/page.tsx` (novo)

## Formato de conclusão

Relatório em `.ai/reports/TASK-017-event-management-backoffice.md`
