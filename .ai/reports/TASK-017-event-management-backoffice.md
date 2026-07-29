# Relatório TASK-017 — Event Management Backoffice

## Status

COMPLETED

## O que foi feito

- `Event` type atualizado com `version: number`
- `UpdateEventInput` e `ListEventsResponse` adicionados aos tipos
- Schema Zod `updateEventSchema`: `title` (1-500), `description` (nullable, opcional), `version` (int positivo)
- `ApiError` exportado para uso no `EditEventForm`
- API: `listEvents(orgId, params, devUserId)` e `updateEvent(orgId, eventId, input, devUserId)`
- Hook `useListEvents`: useQuery com cursor state, acumula páginas, expõe `loadMore()`
- Hook `useUpdateEvent`: useMutation sobre PATCH
- `EventList`: lista de cards com title, status (localizado), version, link "Editar" apenas para DRAFT, botão "Carregar mais"
- `EditEventForm`: campos title + description, versão oculta em hidden input, 409 → mensagem de conflito específica, disable durante submit
- Página `/organizations/[orgId]/events`: lista + link "Novo evento"
- Página `/organizations/[orgId]/events/[eventId]/edit`: exibe formulário de edição; bloqueia se status ≠ DRAFT; redireciona para detail após sucesso
- Build passou, typecheck limpo, lint OK

## Arquivos modificados/criados

- `apps/backoffice-web/src/features/events/types/index.ts`
- `apps/backoffice-web/src/features/events/schemas/index.ts`
- `apps/backoffice-web/src/features/events/api/events.api.ts`
- `apps/backoffice-web/src/features/events/hooks/use-list-events.ts` (novo)
- `apps/backoffice-web/src/features/events/hooks/use-update-event.ts` (novo)
- `apps/backoffice-web/src/features/events/components/EventList.tsx` (novo)
- `apps/backoffice-web/src/features/events/components/EditEventForm.tsx` (novo)
- `apps/backoffice-web/src/features/events/index.ts`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/page.tsx` (novo)
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/edit/page.tsx` (novo)
