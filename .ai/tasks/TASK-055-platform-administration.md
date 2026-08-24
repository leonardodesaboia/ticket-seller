TASK-055 — Platform Administration

Status: CONCLUÍDA

Objetivo

Criar infraestrutura mínima de administração de plataforma: coluna `platform_role` em `users`, guard dedicado para platform admins, endpoints de leitura do estado global e ações administrativas básicas (suspender organização, suspender usuário, bloquear payout). Adicionar seção `/admin` no backoffice com listagens e ações.

Resultado observável

- `GET /admin/dashboard` retorna contadores: organizations, users, events, orders, payouts.
- `GET /admin/organizations` lista organizações com status e contadores.
- `GET /admin/users` lista usuários com status e platform_role.
- `POST /admin/organizations/:orgId/suspend` suspende organização.
- `POST /admin/organizations/:orgId/unsuspend` reativa organização.
- `POST /admin/users/:userId/suspend` suspende usuário.
- `POST /admin/users/:userId/unsuspend` reativa usuário.
- `POST /admin/payouts/:payoutId/block` bloqueia payout REQUESTED/PROCESSING.
- Página `/admin` no backoffice protegida por role de platform admin.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-055-platform-administration.md
- docs/modules/administration.md
- apps/api/prisma/schema.prisma (estado após TASK-054)
- apps/api/src/platform/http/guards/actor.guard.ts
- apps/api/src/shared/kernel/actor.types.ts
- apps/backoffice-web/src/features/ (referência de padrão existente)

Migration (base: após TASK-054)

```
20260818000036_platform_roles
  ALTER TABLE users
    ADD COLUMN platform_role VARCHAR(32),
    ADD COLUMN suspended_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_platform_role CHECK (
      platform_role IS NULL OR platform_role IN ('PLATFORM_SUPPORT','PLATFORM_ADMIN')
    );

  ALTER TABLE organizations
    ADD COLUMN suspended_at TIMESTAMPTZ;
```

Arquivos permitidos

Backend:
- apps/api/src/shared/kernel/platform-role.ts (NOVO — PlatformRole enum)
- apps/api/src/platform/http/guards/platform-role.guard.ts (NOVO)
- apps/api/src/modules/platform-admin/ (NOVO módulo)
  - application/use-cases/get-platform-dashboard.use-case.ts
  - application/use-cases/suspend-organization.use-case.ts + .spec.ts
  - application/use-cases/unsuspend-organization.use-case.ts
  - application/use-cases/suspend-user.use-case.ts + .spec.ts
  - application/use-cases/unsuspend-user.use-case.ts
  - application/use-cases/block-payout.use-case.ts + .spec.ts
  - application/use-cases/list-admin-organizations.use-case.ts
  - application/use-cases/list-admin-users.use-case.ts
  - presentation/controllers/admin.controller.ts
  - presentation/dtos/
  - platform-admin.module.ts
- apps/api/src/app.module.ts (EXPANDIR — importar PlatformAdminModule)
- apps/api/prisma/schema.prisma (EXPANDIR — platform_role + suspended_at)
- apps/api/prisma/migrations/ (1 nova migration)

Frontend (backoffice):
- apps/backoffice-web/src/features/platform-admin/ (NOVA feature)
  - api/admin.api.ts
  - components/AdminDashboardCards.tsx
  - components/OrganizationsAdminTable.tsx
  - components/UsersAdminTable.tsx
  - hooks/useAdminDashboard.ts
  - hooks/useAdminOrganizations.ts
  - hooks/useAdminUsers.ts
  - index.ts
- apps/backoffice-web/src/app/admin/page.tsx (NOVA rota — protegida por platform_role)
- apps/backoffice-web/src/app/admin/organizations/page.tsx
- apps/backoffice-web/src/app/admin/users/page.tsx

Arquivos proibidos

- apps/api/src/modules/finance/ (sem alterações)
- apps/api/src/modules/identity/ (sem alterações)
- apps/api/src/modules/organizations/ (sem alterações — platform admin usa acesso direto ao DB)
- pnpm-lock.yaml

Requisitos funcionais

1. `PlatformRoleGuard`:
   - Lê actor do contexto.
   - Busca `users.platform_role` pelo userId.
   - Requer role mínimo especificado no decorator: PLATFORM_SUPPORT ou PLATFORM_ADMIN.
   - 403 se platform_role IS NULL ou insuficiente.

2. `GET /admin/dashboard` (PLATFORM_SUPPORT+):
   - Retorna: totalOrganizations, totalUsers, totalEvents, activeOrders (CONFIRMED/PROCESSING), pendingPayouts, processingPayouts, suspendedOrganizations.

3. `GET /admin/organizations?cursor=&limit=` (PLATFORM_SUPPORT+):
   - Keyset por created_at DESC.
   - Campos: id, name, suspended_at, memberCount, eventCount, createdAt.

4. `GET /admin/users?cursor=&limit=` (PLATFORM_SUPPORT+):
   - Keyset por created_at DESC.
   - Campos: id, email, displayName, platform_role, suspended_at, createdAt.

5. `POST /admin/organizations/:orgId/suspend` (PLATFORM_ADMIN):
   - Requer body `{ reason: string }` (obrigatório).
   - Sets organizations.suspended_at = now.
   - Registra AuditEntry: actor, resource=Organization, action=SUSPEND, reason.
   - Idempotente (já suspensa → 200).

6. `POST /admin/organizations/:orgId/unsuspend` (PLATFORM_ADMIN):
   - Requer body `{ reason: string }`.
   - Sets organizations.suspended_at = null.
   - Registra AuditEntry.

7. `POST /admin/users/:userId/suspend` e `/unsuspend` (PLATFORM_ADMIN):
   - Mesma lógica de organizações.
   - Não permite suspender outros PLATFORM_ADMIN (422).
   - Não permite auto-suspensão.

8. `POST /admin/payouts/:payoutId/block` (PLATFORM_ADMIN):
   - Só bloqueia payouts com status REQUESTED ou PROCESSING.
   - Sets status = BLOCKED (novo status no enum).
   - Registra AuditEntry.

9. Suspended check middleware:
   - ActorGuard verifica `users.suspended_at IS NULL` — usuário suspenso → 403.
   - OrganizationRoleGuard verifica `organizations.suspended_at IS NULL` — organização suspensa → 403.

Invariantes

- PLATFORM_ADMIN não pode suspender outro PLATFORM_ADMIN.
- AuditEntry obrigatório em todas as ações de admin (suspend, unsuspend, block).
- `reason` é campo obrigatório em todas as ações de platform admin.

Segurança

- Todas as rotas `/admin/*` exigem PlatformRoleGuard.
- Platform admin não tem acesso a dados financeiros granulares (só contadores) — endpoints financeiros detalhados requerem OrganizationRoleGuard do módulo finance.
- Logs de ações admin incluem actor, resource, action, reason (sem PII sensível além do necessário).

Fora do escopo

- Impersonação de usuário.
- Acesso admin a dados financeiros detalhados (ledger entries individuais).
- Configuração de fee_policies via admin UI.
- Criação de plataform admins via API (feita diretamente no banco com migration ou script).

Critérios de aceite

- Usuário sem platform_role → 403 em qualquer rota `/admin/*`.
- PLATFORM_SUPPORT → 403 em rotas de PLATFORM_ADMIN.
- Suspend/unsuspend registra AuditEntry com reason.
- Organização suspensa → OrganizationRoleGuard retorna 403 para membros.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api prisma migrate dev --name platform_roles
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/backoffice-web lint
pnpm --filter @ticket-seller/backoffice-web typecheck
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-056 — Media & Uploads Foundation.
