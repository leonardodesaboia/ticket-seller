Relatório da TASK-055 — Platform Administration

Status

COMPLETED

Commit

07611f2 — feat(platform-admin): implement TASK-055 — platform administration

Arquivos alterados

apps/api/prisma/migrations/20260818000036_platform_roles/migration.sql: criado — colunas platform_role e suspended_at em users; coluna suspended_at em organizations; CONSTRAINT chk_platform_role
apps/api/prisma/migrations/20260818000036a_payout_blocked_status/migration.sql: criado — adiciona 'BLOCKED' ao CHECK constraint de payouts.status (corrige omissão no schema original)
apps/api/prisma/schema.prisma: expandido — PlatformRole enum, campos suspendedAt em User e Organization
apps/api/src/shared/kernel/platform-role.ts: criado — enum PlatformRole + PLATFORM_ROLE_HIERARCHY
apps/api/src/platform/http/decorators/require-platform-role.decorator.ts: criado — decorator @RequirePlatformRole(role)
apps/api/src/platform/http/guards/platform-role.guard.ts: criado — verifica PlatformRole do actor com hierarquia (PLATFORM_ADMIN > PLATFORM_SUPPORT)
apps/api/src/platform/http/guards/actor.guard.ts: modificado — verifica users.suspendedAt após resolução do actor; lança ForbiddenException se conta suspensa
apps/api/src/platform/http/guards/actor.guard.spec.ts: modificado — testes para verificação de suspensão
apps/api/src/platform/http/guards/organization-role.guard.ts: modificado — verifica organizations.suspendedAt antes de autorizar ação
apps/api/src/modules/platform-admin/platform-admin.module.ts: criado — módulo completo com 8 use cases e AdminController
apps/api/src/modules/platform-admin/presentation/controllers/admin.controller.ts: criado — endpoints /admin/*
apps/api/src/modules/platform-admin/presentation/dtos/suspend.dto.ts: criado — SuspendDto com reason (mínimo 10 caracteres)
apps/api/src/modules/platform-admin/application/use-cases/get-platform-dashboard.use-case.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/list-admin-organizations.use-case.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/list-admin-users.use-case.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/suspend-organization.use-case.ts + .spec.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/unsuspend-organization.use-case.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/suspend-user.use-case.ts + .spec.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/unsuspend-user.use-case.ts: criado
apps/api/src/modules/platform-admin/application/use-cases/block-payout.use-case.ts + .spec.ts: criado
apps/api/src/app.module.ts: modificado — PlatformAdminModule registrado
apps/backoffice-web/src/app/admin/page.tsx: criado — dashboard de plataforma
apps/backoffice-web/src/app/admin/organizations/page.tsx: criado — listagem e ações em organizações
apps/backoffice-web/src/app/admin/users/page.tsx: criado — listagem e ações em usuários
apps/backoffice-web/src/features/platform-admin/: criado — api, components, hooks

Implementado

PlatformRole enum com PLATFORM_SUPPORT e PLATFORM_ADMIN; hierarquia numérica para comparação de nível mínimo
PlatformRoleGuard verificando platform_role do usuário autenticado contra nível mínimo requerido pelo decorator
Verificação de suspensão de conta no ActorGuard: toda requisição autenticada verifica users.suspendedAt; conta suspensa → 403 antes de qualquer use case
Verificação de suspensão de organização no OrganizationRoleGuard: toda operação de membro verifica organizations.suspendedAt; org suspensa → 403
GET /admin/dashboard — estatísticas agregadas de usuários, organizações e eventos
GET /admin/organizations — listagem com filtros (status, busca) + paginação
GET /admin/users — listagem com filtros + paginação
POST /admin/organizations/:id/suspend e /unsuspend — suspensão de organizações com razão obrigatória
POST /admin/users/:id/suspend e /unsuspend — suspensão de usuários com proteções: não permite suspender PLATFORM_ADMIN e não permite auto-suspensão
POST /admin/payouts/:id/block — bloqueia payout em status SCHEDULED ou PROCESSING, grava status BLOCKED
Três páginas no backoffice-web com visualização de dados e ações de suspensão

Decisões tomadas

migration 036a (payout_blocked_status) criada separadamente: status 'BLOCKED' não estava no CHECK constraint original de payouts; criada migration complementar em vez de alterar a migration existente (que já foi aplicada)
Proteção contra suspender PLATFORM_ADMIN: o use case suspend-user verifica se o target tem platformRole=PLATFORM_ADMIN e lança 422 — evita lockout acidental da plataforma
Proteção contra auto-suspensão: o use case suspend-user verifica actor.userId === target.id e lança 422
Block-payout verifica status SCHEDULED ou PROCESSING (não 'REQUESTED' — esse status não existe no domínio de payouts); grava 'BLOCKED' após migration 036a

Testes executados

Comando	Resultado
npx tsc --noEmit	aprovado (0 erros)
npx jest	413/413 aprovados (antes: 401/401 — +12 testes)

Bugs corrigidos durante revisão

block-payout.use-case usava status 'REQUESTED' (inexistente no enum): corrigido para 'SCHEDULED'
block-payout.use-case escrevia status 'BLOCKED' violando CHECK constraint original: criada migration 036a adicionando 'BLOCKED' à lista de valores permitidos
parseInt sem guarda NaN em admin controller: substituído por Number.isFinite() check com default value

Riscos identificados

Suspensão não invalida tokens JWT existentes: um usuário suspenso com token ativo continua podendo fazer requisições até o token expirar (15min). Para MVP é aceitável; mitigação completa requereria blocklist de tokens (escopo de TASK-057/059)
Suspensão de organização não notifica membros: membros recebem 403 na próxima requisição sem aviso prévio

Pendências

Nenhuma pendência funcional para o MVP.

Documentação atualizada

docs/CURRENT_STATE.md atualizado para refletir conclusão da TASK-055
