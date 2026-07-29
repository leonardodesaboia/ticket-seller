# Relatório TASK-020 — Event Configuration Backoffice

## Status

COMPLETED

## O que foi implementado

### Utilitário
- `shared/lib/money.ts`: `toMinorUnits(amount)` e `toDisplayValue(minorUnits, currency)` com Intl.NumberFormat pt-BR

### Feature events (extensões)
- `features/events/types/index.ts`: `UpdateEventConfigurationInput` adicionado
- `features/events/api/events.api.ts`: `updateEventConfiguration()` adicionado
- `features/events/hooks/use-update-event-configuration.ts`: hook useMutation
- `features/events/schemas/index.ts`: `updateEventConfigurationSchema` com Zod (validação de data range)
- `features/events/components/EventConfigurationForm.tsx`: formulário de configuração com campos condicionais por formato (VenueSelect para IN_PERSON/HYBRID, onlineInfo para ONLINE/HYBRID), tratamento 409 conflict e 422 currency lock
- `features/events/index.ts`: exporta `EventConfigurationForm` e `UpdateEventConfigurationInput`

### Feature venues (nova)
- `features/venues/types/index.ts`: `Venue`, `CreateVenueInput`
- `features/venues/api/venues.api.ts`: `createVenue`, `listVenues`
- `features/venues/hooks/use-list-venues.ts`, `use-create-venue.ts`
- `features/venues/schemas/index.ts`: `createVenueSchema` com Zod
- `features/venues/components/CreateVenueForm.tsx`: formulário com campos name, address, city, state, country (2 chars), postalCode opcional
- `features/venues/components/VenueSelect.tsx`: select + botão "Novo local" com inline CreateVenueForm
- `features/venues/index.ts`

### Feature ticket-types (nova)
- `features/ticket-types/types/index.ts`: `TicketType`, `CreateTicketTypeInput`, `UpdateTicketTypeInput`, `ListTicketTypesResponse`
- `features/ticket-types/api/ticket-types.api.ts`: `createTicketType` (com Idempotency-Key), `listTicketTypes`, `updateTicketType`
- `features/ticket-types/hooks/use-list-ticket-types.ts`, `use-create-ticket-type.ts`, `use-update-ticket-type.ts`
- `features/ticket-types/schemas/index.ts`: `createTicketTypeSchema`, `updateTicketTypeSchema`
- `features/ticket-types/components/CreateTicketTypeForm.tsx`: formulário com preço (convertido para minor units via toMinorUnits), capacidade, tratamento erro currency-not-set
- `features/ticket-types/components/TicketTypeList.tsx`: lista com exibição de preço via toDisplayValue, deactivation com confirmação, version conflict handling
- `features/ticket-types/index.ts`

### Páginas
- `app/organizations/[organizationId]/events/[eventId]/configuration/page.tsx`: página com seção de configuração + seção de ticket types; só acessível para eventos DRAFT
- `app/organizations/[organizationId]/events/[eventId]/page.tsx`: links "Configurar evento" e "Editar título/descrição" adicionados para eventos DRAFT

## Segurança
- `onlineInfo` NÃO é armazenado na resposta (API não retorna)  — campo de envio apenas
- Idempotency-Key gerado com `useId()` + timestamp — evita retry acidental
- Currency bloqueada via API (422) quando há ingressos ativos — UI exibe mensagem específica
- Multi-tenant: todos os requests incluem organizationId na URL

## Typecheck e lint
- `tsc --noEmit`: zero erros
- ESLint `--max-warnings 0`: zero avisos
