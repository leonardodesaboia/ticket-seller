Relatório da TASK-054 — Organization Members, Roles & Permissions

Status

COMPLETED

Commit

52cf6b8 — feat(organizations): implement TASK-054 — members, roles & permissions

Arquivos alterados

apps/api/prisma/migrations/20260818000035_organization_invitations/migration.sql: criado — tabela organization_invitations com índice para listagem de pendentes
apps/api/prisma/schema.prisma: expandido — modelo OrganizationInvitation, campos suspendedAt antecipados (TASK-055)
apps/api/src/shared/kernel/organization-capability.ts: criado — enum OrganizationCapability + mapa ROLE_CAPABILITIES + VALID_ORGANIZATION_ROLES (única fonte de verdade para roles válidos)
apps/api/src/platform/http/decorators/require-capability.decorator.ts: criado — decorator @RequireCapability(capability)
apps/api/src/platform/http/guards/organization-role.guard.ts: criado — verifica membership ativo, capability por role e suspensão da organização
apps/api/src/modules/organizations/domain/entities/organization-invitation.entity.ts: criado — entidade OrganizationInvitation
apps/api/src/modules/organizations/domain/organization.errors.ts: expandido — MemberNotFoundError, LastOwnerProtectionError, InvitationAlreadyUsedError
apps/api/src/modules/organizations/domain/ports/organization-invitation-repository.port.ts: criado — IOrganizationInvitationRepository
apps/api/src/modules/organizations/infrastructure/repositories/prisma-organization-invitation.repository.ts: criado — PrismaOrganizationInvitationRepository
apps/api/src/modules/organizations/application/use-cases/invite-organization-member.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/application/use-cases/accept-organization-invitation.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/application/use-cases/revoke-organization-invitation.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/application/use-cases/list-organization-members.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/application/use-cases/update-member-role.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/application/use-cases/remove-organization-member.use-case.ts + .spec.ts: criado
apps/api/src/modules/organizations/presentation/controllers/organization-members.controller.ts: criado — GET/PATCH/DELETE /organizations/:orgId/members
apps/api/src/modules/organizations/presentation/controllers/invitations.controller.ts: criado — POST /invitations/:token/accept
apps/api/src/modules/organizations/presentation/dtos/: criado — InviteMemberDto, AcceptInvitationDto, UpdateMemberRoleDto
apps/api/src/modules/organizations/organizations.module.ts: expandido — registra 6 novos use cases, dois controladores e ORGANIZATION_INVITATION_REPOSITORY

Implementado

OrganizationCapability enum com 8 capabilities (MANAGE_MEMBERS, MANAGE_EVENTS, MANAGE_FINANCE, CHECK_IN, VIEW_REPORTS, MANAGE_SETTINGS, CREATE_INVITATIONS, REVOKE_INVITATIONS)
ROLE_CAPABILITIES mapeando cada role (OWNER, ADMIN, FINANCE, EVENT_MANAGER, CHECK_IN_STAFF) às suas capabilities
VALID_ORGANIZATION_ROLES derivado de Object.keys(ROLE_CAPABILITIES) — elimina duplicação e mantém consistência automática
OrganizationRoleGuard: lê actor do contexto, verifica OrganizationMember ativo, verifica capability, verifica suspensão de organização
Seis use cases com cobertura de testes completa: invite, accept, revoke, list-members, update-role, remove-member
POST /organizations/:orgId/invitations — requer capability CREATE_INVITATIONS
POST /invitations/:token/accept — protegido por ActorGuard; userId vem do JWT, não do body (prevenção de account takeover)
GET /organizations/:orgId/members — requer capability MANAGE_MEMBERS
PATCH /organizations/:orgId/members/:memberId — altera role com proteção de último OWNER
DELETE /organizations/:orgId/members/:memberId — remove membro com proteção de último OWNER
DELETE /organizations/:orgId/invitations/:invId — revoga convite pendente

Decisões tomadas

VALID_ORGANIZATION_ROLES derivado de ROLE_CAPABILITIES: evita duplicação e garante que qualquer novo role adicionado ao mapa seja automaticamente válido nos DTOs de validação
OWNER protection via $transaction: updateMemberRoleAtomically e removeMemberAtomically executam SELECT COUNT(OWNER) + UPDATE/soft-delete dentro de uma única transação — elimina race condition TOCTOU
markInvitationUsed via updateMany WHERE usedAt=null: segunda camada de proteção contra uso duplo de token — apenas uma chamada concorrente pode atualizar (updateMany retorna count=0 para a segunda)
ActorGuard obrigatório em /invitations/:token/accept: userId extraído do JWT, não aceito do body — previne que qualquer usuário aceite convite em nome de outro
OrganizationRoleGuard verifica suspensão: embora suspensão seja implementada na TASK-055, o campo suspendedAt foi antecipado no schema e o guard já verifica; nenhuma alteração futura na guard será necessária

Testes executados

Comando	Resultado
npx tsc --noEmit	aprovado (0 erros)
npx jest	401/401 aprovados (antes: 376/376 — +25 testes)

Bugs corrigidos durante revisão

TOCTOU em accept-invitation: uso de updateMany({ where: { usedAt: null } }) em vez de update simples
Race condition em update-role e remove-member: operações atômicas via $transaction substituindo leitura + escrita separadas
VALID_ORGANIZATION_ROLES duplicado em invitation DTO: substituído por importação de organization-capability.ts
Account takeover em accept endpoint: removido userId do body; ActorGuard obrigatório

Riscos identificados

Tokens de convite não expiram ativamente — o campo expires_at é verificado no accept use case, mas nenhum job de cleanup existe; convites expirados permanecem na tabela indefinidamente (aceitável para MVP)
Nenhuma paginação implementada em list-organization-members; pode ser lento para organizações com muitos membros (fora do escopo da TASK-054)

Pendências

Nenhuma pendência funcional. Endpoints de convite por email dependem de template de email não especificado na TASK-054.

Documentação atualizada

docs/CURRENT_STATE.md atualizado para refletir conclusão da TASK-054
