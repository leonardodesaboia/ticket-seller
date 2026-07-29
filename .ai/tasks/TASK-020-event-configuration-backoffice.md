# TASK-020 — Event Configuration Backoffice

## Identificador

TASK-020

## Título

Event Configuration Backoffice

## Objetivo

Implementar a UI de configuração de eventos no backoffice: formulário de schedule/venue/currency, integração com TASK-018 (PATCH /configuration) e TASK-019 (ticket types). Inclui seleção de venue, criação inline de venue e gerenciamento de ticket types.

## Status

COMPLETED

## Dependências

TASK-018 (PATCH /configuration endpoint)
TASK-019 (ticket types endpoints)
TASK-017 (estrutura base do backoffice)

## Propriedade exclusiva

- `apps/backoffice-web/src/features/venues/`
- `apps/backoffice-web/src/features/ticket-types/`
- `apps/backoffice-web/src/features/events/hooks/use-update-event-configuration.ts`
- `apps/backoffice-web/src/features/events/schemas/` (configuração)
- `apps/backoffice-web/src/features/events/components/EventConfigurationForm.tsx`
- `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/configuration/`
- `apps/backoffice-web/src/shared/lib/money.ts`

## Contratos consumidos

```
PATCH /api/v1/organizations/:organizationId/events/:eventId/configuration
POST  /api/v1/organizations/:organizationId/venues
GET   /api/v1/organizations/:organizationId/venues
POST  /api/v1/organizations/:organizationId/events/:eventId/ticket-types
GET   /api/v1/organizations/:organizationId/events/:eventId/ticket-types
PATCH /api/v1/organizations/:organizationId/events/:eventId/ticket-types/:ticketTypeId
```

## Formato de conclusão

Relatório em `.ai/reports/TASK-020-event-configuration-backoffice.md`
