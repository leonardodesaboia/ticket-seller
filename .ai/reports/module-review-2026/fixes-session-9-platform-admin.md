# Fixes Session 9 — Platform-Admin — 2026-08-26

## A1 — Ports & adapters criados

### Ports criados

- `apps/api/src/modules/platform-admin/domain/ports/admin-user-repository.port.ts`
  - `ADMIN_USER_REPOSITORY` token
  - `IAdminUserRepository`: `findById`, `findAll`, `suspend`, `unsuspend`, `revokeAllSessions`

- `apps/api/src/modules/platform-admin/domain/ports/admin-organization-repository.port.ts`
  - `ADMIN_ORGANIZATION_REPOSITORY` token
  - `IAdminOrganizationRepository`: `findById`, `findAll`, `suspend`, `unsuspend`, `revokeMemberSessions`

- `apps/api/src/modules/platform-admin/domain/ports/admin-payout-repository.port.ts`
  - `ADMIN_PAYOUT_REPOSITORY` token
  - `IAdminPayoutRepository`: `findById`, `blockIfBlockable`

- `apps/api/src/modules/platform-admin/domain/ports/admin-dashboard-repository.port.ts`
  - `ADMIN_DASHBOARD_REPOSITORY` token
  - `IAdminDashboardRepository`: `getDashboardCounts`

### Adapters criados

- `apps/api/src/modules/platform-admin/infrastructure/repositories/prisma-admin-user.repository.ts`
  - `PrismaAdminUserRepository implements IAdminUserRepository`
  - Lógica extraída de: `SuspendUserUseCase`, `UnsuspendUserUseCase`, `ListAdminUsersUseCase`
  - Inclui `revokeAllSessions` via `prisma.session.updateMany`

- `apps/api/src/modules/platform-admin/infrastructure/repositories/prisma-admin-organization.repository.ts`
  - `PrismaAdminOrganizationRepository implements IAdminOrganizationRepository`
  - Lógica extraída de: `SuspendOrganizationUseCase`, `UnsuspendOrganizationUseCase`, `ListAdminOrganizationsUseCase`
  - Inclui `revokeMemberSessions` via `$executeRaw` (ver M4)

- `apps/api/src/modules/platform-admin/infrastructure/repositories/prisma-admin-payout.repository.ts`
  - `PrismaAdminPayoutRepository implements IAdminPayoutRepository`
  - Lógica extraída de: `BlockPayoutUseCase`

- `apps/api/src/modules/platform-admin/infrastructure/repositories/prisma-admin-dashboard.repository.ts`
  - `PrismaAdminDashboardRepository implements IAdminDashboardRepository`
  - Lógica extraída de: `GetPlatformDashboardUseCase`

### Use cases atualizados

- `suspend-organization.use-case.ts` — removido `PrismaService`, injetado `ADMIN_ORGANIZATION_REPOSITORY`; adicionado `revokeMemberSessions` (M4)
- `unsuspend-organization.use-case.ts` — removido `PrismaService`, injetado `ADMIN_ORGANIZATION_REPOSITORY`
- `suspend-user.use-case.ts` — removido `PrismaService`, injetado `ADMIN_USER_REPOSITORY`; adicionado `revokeAllSessions` (M4)
- `unsuspend-user.use-case.ts` — removido `PrismaService`, injetado `ADMIN_USER_REPOSITORY`
- `list-admin-users.use-case.ts` — removido `PrismaService`, injetado `ADMIN_USER_REPOSITORY`
- `list-admin-organizations.use-case.ts` — removido `PrismaService`, injetado `ADMIN_ORGANIZATION_REPOSITORY`
- `get-platform-dashboard.use-case.ts` — removido `PrismaService`, injetado `ADMIN_DASHBOARD_REPOSITORY`
- `block-payout.use-case.ts` — removido `PrismaService`, injetado `ADMIN_PAYOUT_REPOSITORY`

## M4 — Session invalidation on suspend

- **Abordagem — usuário individual (`SuspendUserUseCase`):** chamada a `userRepo.revokeAllSessions(userId)` após `suspend`. O adapter faz `prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })`.

- **Abordagem — organização (`SuspendOrganizationUseCase`):** chamada a `orgRepo.revokeMemberSessions(organizationId)` após `suspend`. O adapter usa `prisma.$executeRaw` com uma subquery que une `organization_members` e `sessions`, revogando todas as sessões ativas (`revokedAt IS NULL`) de membros não removidos (`removed_at IS NULL`) da organização. Não houve cross-module coupling com o módulo `identity` — a operação é contida no adapter `PrismaAdminOrganizationRepository`.

- **Decisão arquitetural:** a revogação em massa via `$executeRaw` foi preferida à reutilização do `ISessionRepository` do módulo `identity` para evitar acoplamento entre módulos. O adapter do platform-admin possui acesso ao `PrismaService` e pode operar diretamente nas tabelas `sessions` e `organization_members`.

- **Arquivo principal:** `suspend-organization.use-case.ts` + `prisma-admin-organization.repository.ts`

## Testes

- **15 testes passando** nos 3 spec files do módulo `platform-admin`
  - `suspend-organization.use-case.spec.ts`: 3 testes (incluindo novo teste de 404 e verificação de `revokeMemberSessions`)
  - `suspend-user.use-case.spec.ts`: 6 testes (verificações de idempotência, roles, sessão revogada)
  - `block-payout.use-case.spec.ts`: 6 testes
- **401 testes passando** no total da suite; 14 falhas pré-existentes em outros módulos (tickets, payments, finance, actor.guard) não relacionadas a platform-admin
