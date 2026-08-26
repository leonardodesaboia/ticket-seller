# TASK-063 — Substituição de X-Dev-User-Id por autenticação JWT real

**Data:** 2026-08-26  
**Sessão:** 9  

---

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `apps/backoffice-web/src/features/auth/api/auth.api.ts` | Funções de fetch: `login`, `logout`, `getMe`, `refreshToken` |
| `apps/backoffice-web/src/features/auth/context/AuthContext.tsx` | Provider de sessão com estado em memória, inicialização via refresh cookie |
| `apps/backoffice-web/src/features/auth/hooks/useAuth.ts` | Hook `useAuth()` que consome o `AuthContext` |
| `apps/backoffice-web/src/features/auth/components/LoginPage.tsx` | Formulário de login com React Hook Form + Zod |
| `apps/backoffice-web/src/features/auth/index.ts` | Barrel exports da feature de auth |
| `apps/backoffice-web/src/shared/components/RouteGuard.tsx` | Componente de proteção de rotas — redireciona para `/login` quando não autenticado |
| `apps/backoffice-web/src/app/login/page.tsx` | Rota pública `/login` |

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `apps/backoffice-web/src/shared/api/api-client.ts` | Adicionada `createAuthenticatedFetch` com refresh automático em 401 |
| `apps/backoffice-web/src/app/providers.tsx` | Adicionado `AuthProvider` e `RouteGuard` ao tree de providers |
| `apps/backoffice-web/src/features/events/api/events.api.ts` | Substituído `devUserId`/`X-Dev-User-Id` por `token` + `Authorization: Bearer` |
| `apps/backoffice-web/src/features/organizations/api/organizations.api.ts` | Idem |
| `apps/backoffice-web/src/features/ticket-types/api/ticket-types.api.ts` | Idem |
| `apps/backoffice-web/src/features/venues/api/venues.api.ts` | Idem |
| `apps/backoffice-web/src/features/events/hooks/use-create-event.ts` | Removido parâmetro `devUserId`; token via `useAuth()` |
| `apps/backoffice-web/src/features/events/hooks/use-update-event.ts` | Idem |
| `apps/backoffice-web/src/features/events/hooks/use-update-event-configuration.ts` | Idem |
| `apps/backoffice-web/src/features/events/hooks/use-get-event.ts` | Idem |
| `apps/backoffice-web/src/features/events/hooks/use-list-events.ts` | Idem |
| `apps/backoffice-web/src/features/venues/hooks/use-list-venues.ts` | Idem |
| `apps/backoffice-web/src/features/venues/hooks/use-create-venue.ts` | Idem |
| `apps/backoffice-web/src/features/organizations/hooks/use-create-organization.ts` | Idem |
| `apps/backoffice-web/src/features/ticket-types/hooks/use-list-ticket-types.ts` | Idem |
| `apps/backoffice-web/src/features/ticket-types/hooks/use-create-ticket-type.ts` | Idem |
| `apps/backoffice-web/src/features/ticket-types/hooks/use-update-ticket-type.ts` | Idem |
| `apps/backoffice-web/src/features/events/components/CreateEventForm.tsx` | Removido `devUserId` das props |
| `apps/backoffice-web/src/features/events/components/EditEventForm.tsx` | Idem |
| `apps/backoffice-web/src/features/events/components/EventConfigurationForm.tsx` | Idem |
| `apps/backoffice-web/src/features/venues/components/VenueSelect.tsx` | Idem |
| `apps/backoffice-web/src/features/venues/components/CreateVenueForm.tsx` | Idem |
| `apps/backoffice-web/src/features/organizations/components/CreateOrganizationForm.tsx` | Idem |
| `apps/backoffice-web/src/features/ticket-types/components/CreateTicketTypeForm.tsx` | Idem |
| `apps/backoffice-web/src/features/ticket-types/components/TicketTypeList.tsx` | Idem (incluindo `TicketTypeRow` interno) |
| `apps/backoffice-web/src/app/organizations/new/page.tsx` | Removido `DEV_USER_ID` |
| `apps/backoffice-web/src/app/organizations/[organizationId]/events/page.tsx` | Idem |
| `apps/backoffice-web/src/app/organizations/[organizationId]/events/new/page.tsx` | Idem |
| `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/page.tsx` | Idem |
| `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/edit/page.tsx` | Idem |
| `apps/backoffice-web/src/app/organizations/[organizationId]/events/[eventId]/configuration/page.tsx` | Idem |

---

## Resultado dos Testes

```
PASS src/features/ticket-types/lib/idempotency-operation.spec.ts
PASS src/features/organizations/schemas/index.spec.ts
PASS src/features/events/schemas/index.spec.ts
PASS src/app/page.test.tsx

Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        1.147 s
```

TypeScript: `tsc --noEmit` — sem erros.

---

## Decisões de Design

1. **Token em memória, não em localStorage** — O `accessToken` é armazenado apenas no estado React (`useState`). O refresh token reside no cookie HttpOnly gerenciado pelo backend.

2. **Inicialização via refresh** — Na montagem do `AuthProvider`, antes de marcar `isLoading=false`, a app tenta chamar `POST /api/v1/auth/refresh`. Se o cookie HttpOnly estiver válido, a sessão é restaurada sem exigir novo login.

3. **Token passado por parâmetro às funções de API** — Optou-se por não usar module-level state para o token. Cada hook obtém o token via `useAuth()` e passa-o à função de API. Isso mantém as funções de API testáveis e sem acoplamento a React.

4. **`createAuthenticatedFetch` no api-client** — Exportada para uso futuro ou por consumidores que precisem de fetch autenticado fora de hooks React.

5. **RouteGuard no lado cliente** — O guard opera no lado cliente via `useEffect`, seguindo o padrão App Router com componentes `'use client'`. Rotas protegidas retornam `null` enquanto o redirecionamento ocorre para evitar flash de conteúdo.

6. **`enabled: Boolean(token)`** — Queries que requerem autenticação não executam enquanto `token === null`, prevenindo chamadas sem autorização durante a inicialização.
