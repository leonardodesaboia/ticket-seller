# TASK-063 — Backoffice Auth Integration

## Status

READY

## Contexto

TASK-053 implementou o backend de autenticação completo (argon2id, JWT, refresh token rotation, HttpOnly cookie). Contudo, o `apps/backoffice-web` nunca foi atualizado para usar esse sistema: toda a autenticação ainda passa pelo header `X-Dev-User-Id` lido de `NEXT_PUBLIC_DEV_USER_ID`.

Problema identificado na revisão de código como **BO-01 (ALTO)** em `.ai/reports/module-review-2026/frontend-features-remaining.md`.

## Impacto

- Em produção, se `NEXT_PUBLIC_DEV_USER_ID` não estiver definido, todas as requisições autenticadas do backoffice serão enviadas sem identificação de usuário.
- Se estiver definido com um ID real, é um vetor de sequestro de sessão (qualquer pessoa com acesso ao JS bundle da app).
- Afeta: attendance polling, finance, organizations, platform-admin, checkin, events, qualquer endpoint autenticado.

## Escopo

### Backend (já pronto — TASK-053)
- `POST /api/v1/auth/register` — registro
- `POST /api/v1/auth/login` — login, retorna access token no body + refresh token em cookie HttpOnly
- `POST /api/v1/auth/refresh` — renova access token
- `DELETE /api/v1/auth/logout` — revoga sessão
- `GET /api/v1/auth/me` — retorna perfil do usuário autenticado

### Frontend (a implementar)
1. **Página de login** — formulário email + senha, chama `POST /api/v1/auth/login`, armazena access token (localStorage ou memória).
2. **Contexto de sessão** — `AuthContext` / `useAuth` hook que expõe `userId`, `token`, `logout`.
3. **API client** — injetar `Authorization: Bearer <token>` em todas as requisições autenticadas (substituir `X-Dev-User-Id`).
4. **Refresh automático** — interceptar 401 e chamar `POST /api/v1/auth/refresh` antes de re-tentar.
5. **Proteção de rotas** — redirecionar para `/login` se não autenticado.
6. **Logout** — chamar `DELETE /api/v1/auth/logout` e limpar token local.
7. **Remover `NEXT_PUBLIC_DEV_USER_ID`** de todos os hooks, APIs e componentes.

### Arquivos afetados (principais)
- `apps/backoffice-web/src/shared/api/api-client.ts` — injetar Bearer token
- `apps/backoffice-web/src/shared/api/attendance.api.ts` — remover `devUserId`
- `apps/backoffice-web/src/shared/api/finance.api.ts` — remover `devUserId`
- `apps/backoffice-web/src/features/organizations/api/organizations.api.ts` — remover `devUserId`
- `apps/backoffice-web/src/features/platform-admin/api/admin.api.ts` — remover `devUserId`
- Todos os hooks que recebem `devUserId` como parâmetro
- Novo: `apps/backoffice-web/src/features/auth/` — login, logout, context

## Critérios de conclusão

- [ ] Página de login funcional integrada com `POST /api/v1/auth/login`
- [ ] Access token injetado automaticamente em todas as requisições
- [ ] Refresh automático funcionando
- [ ] `NEXT_PUBLIC_DEV_USER_ID` removido de todos os arquivos
- [ ] Rotas protegidas redirecionam para login se não autenticado
- [ ] Testes para `useAuth` e `api-client` com token
- [ ] Logout funcional

## Dependências

- TASK-053 (backend) — CONCLUÍDA
- Nenhuma outra pendência

## Referências

- `apps/api/src/modules/identity/presentation/controllers/auth.controller.ts`
- `apps/api/src/modules/identity/infrastructure/adapters/jwt-actor.adapter.ts`
- `.ai/reports/module-review-2026/frontend-features-remaining.md` — BO-01, BO-02
