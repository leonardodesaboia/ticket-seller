TASK-054 — Organization Members, Roles & Permissions

Status: PLANNED

Objetivo

Implementar o fluxo completo de convite, aceitação, alteração de role e remoção de membros de organização. Criar um sistema de capabilities baseado em roles, com proteção de invariante para o último OWNER. Adicionar endpoints de gerenciamento de membros ao módulo organizations.

Resultado observável

- `POST /organizations/:orgId/invitations` envia convite por email com link de aceitação.
- `POST /invitations/:token/accept` cria OrganizationMember, marca convite como usado.
- `GET /organizations/:orgId/members` lista membros com role e status.
- `PATCH /organizations/:orgId/members/:memberId` altera role (com proteção de último OWNER).
- `DELETE /organizations/:orgId/members/:memberId` remove membro (com proteção de último OWNER).
- `DELETE /organizations/:orgId/invitations/:invId` revoga convite pendente.
- Sistema de capabilities mapeando role → set de ações permitidas.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-054-organization-members-roles-permissions.md
- docs/modules/organizations.md
- apps/api/src/modules/organizations/ (código completo)
- apps/api/src/shared/kernel/ (actor.types.ts e demais)
- apps/api/prisma/schema.prisma (estado após TASK-053)
- apps/api/src/platform/http/guards/actor.guard.ts

Migration (base: após TASK-053)

```
20260818000035_organization_invitations
  - id UUID PK
  - organization_id UUID FK organizations.id NOT NULL
  - inviter_id UUID FK users.id NOT NULL
  - email VARCHAR(320) NOT NULL
  - role VARCHAR(64) NOT NULL
  - token_hash TEXT NOT NULL UNIQUE
  - expires_at TIMESTAMPTZ NOT NULL (7 dias)
  - used_at TIMESTAMPTZ
  - revoked_at TIMESTAMPTZ
  - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  - INDEX (organization_id, used_at, revoked_at) para listagem de pendentes
  - CONSTRAINT chk_role CHECK (role IN ('OWNER','ADMIN','FINANCE','EVENT_MANAGER','CHECK_IN_STAFF'))
```

Arquivos permitidos

Backend:
- apps/api/src/shared/kernel/organization-capability.ts (NOVO — enum de capabilities + mapa role→capabilities)
- apps/api/src/platform/http/guards/organization-role.guard.ts (NOVO — verifica membership + capability)
- apps/api/src/modules/organizations/domain/entities/organization-invitation.entity.ts (NOVO)
- apps/api/src/modules/organizations/domain/ports/organization-invitation.repository.port.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/invite-organization-member.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/accept-organization-invitation.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/revoke-organization-invitation.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/list-organization-members.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/update-member-role.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/application/use-cases/remove-organization-member.use-case.ts + .spec.ts (NOVO)
- apps/api/src/modules/organizations/infrastructure/repositories/prisma-organization-invitation.repository.ts (NOVO)
- apps/api/src/modules/organizations/presentation/controllers/organization-members.controller.ts (NOVO)
- apps/api/src/modules/organizations/presentation/controllers/invitations.controller.ts (NOVO — rota pública /invitations/:token/accept)
- apps/api/src/modules/organizations/presentation/dtos/ (novos DTOs)
- apps/api/src/modules/organizations/organizations.module.ts (EXPANDIR)
- apps/api/prisma/schema.prisma (EXPANDIR — OrganizationInvitation model)
- apps/api/prisma/migrations/ (1 nova migration)
- apps/api/test/integration/organizations/ (testes de integração)

Arquivos proibidos

- apps/api/src/modules/identity/ (sem alterações)
- apps/api/src/modules/finance/ (sem alterações)
- pnpm-lock.yaml

Requisitos funcionais

1. Capabilities por role:

| Role | Capabilities |
|------|-------------|
| OWNER | members.manage, invitations.manage, organization.settings, events.manage, finance.read, payout.request, checkin.perform, roles.assign |
| ADMIN | members.manage, invitations.manage, events.manage, finance.read, checkin.perform |
| FINANCE | finance.read, payout.request |
| EVENT_MANAGER | events.manage, checkin.perform |
| CHECK_IN_STAFF | checkin.perform |

2. `OrganizationRoleGuard`:
   - Lê actor do contexto (ActorGuard já resolveu).
   - Busca OrganizationMember onde organizationId = path param e userId = actor.userId e status = ACTIVE.
   - Verifica que o role do membro possui a capability requerida.
   - 403 se não possui membership ativa ou capability insuficiente.

3. `POST /organizations/:orgId/invitations` (requer members.manage):
   - Valida que email não é já membro ativo.
   - Cria OrganizationInvitation com token = UUID4 → SHA-256, expires_at = now + 7d.
   - Envia email com link `{FRONTEND_URL}/invitations/{token}/accept`.
   - Responde 201 com invitation id e email.

4. `POST /invitations/:token/accept` (público — sem ActorGuard):
   - Verifica token: SHA-256 do token bruto bate com token_hash.
   - Verifica: used_at IS NULL, revoked_at IS NULL, expires_at > now.
   - Requer o usuário autenticado (lê userId do cookie/Bearer) OU cria conta se não existir (somente se email do token = email cadastrado).
   - Cria OrganizationMember com role da invitation e status = ACTIVE.
   - Marca invitation.used_at = now.
   - 200 com `{ organizationId, role }`.

5. `GET /organizations/:orgId/members` (requer members.manage):
   - Retorna lista de membros ativos + convites pendentes (status separado).
   - Campos: id, userId, email, displayName, role, status, joinedAt.

6. `PATCH /organizations/:orgId/members/:memberId` (requer roles.assign):
   - Valida novo role não é inválido.
   - OWNER protection: se membro atual é OWNER, verifica COUNT(OWNER ativos) > 1 antes de alterar.
   - Aplica mudança de role.

7. `DELETE /organizations/:orgId/members/:memberId` (requer members.manage):
   - Não permite auto-remoção se for o único OWNER.
   - OWNER protection: COUNT(OWNER ativos) > 1 antes de remover.
   - Sets status = REMOVED, removedAt = now.

8. `DELETE /organizations/:orgId/invitations/:invId` (requer invitations.manage):
   - Sets revoked_at = now.
   - Idempotente (já revogado → 200).

Invariantes

- COUNT(OWNER com status=ACTIVE) >= 1 sempre.
- Alteração de role e remoção de último OWNER → 422 com erro explícito.
- Ambas as verificações de OWNER ocorrem dentro de transação (SELECT COUNT + UPDATE/DELETE atômicos).
- OrganizationMember com status != ACTIVE não conta para verificação de OWNER.
- Token de convite: single-use (used_at IS NULL verificado antes de criar membro).

Segurança

- Endpoint `/invitations/:token/accept` é público mas valida token criptograficamente.
- Não revelar se email já é membro na criação do convite (responder 201 sempre que ação autorizada).
- Cross-tenant: todos endpoints de /organizations/:orgId/* filtram por organizationId do path.

Fora do escopo

- Transferência de ownership (pós-MVP).
- Convites em lote.
- SSO/SAML.
- Permissões granulares além de capabilities por role.

Critérios de aceite

- Convite criado → email enviado → token aceito → membro criado com role correto.
- Tentativa de remover único OWNER → 422.
- Tentativa de alterar role do único OWNER para não-OWNER → 422.
- Membro sem capability correta → 403.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api prisma migrate dev --name organization_invitations
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=organizations
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-055 — Platform Administration.
