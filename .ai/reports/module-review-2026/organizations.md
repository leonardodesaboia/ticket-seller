# Revisão de Módulo — organizations

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

O módulo `organizations` tem arquitetura limpa com testes unitários para todos os use cases e acertos relevantes (transações atômicas, guard de último OWNER). Contudo, há **1 crítico** (qualquer usuário autenticado pode aceitar convite de outra pessoa), **3 altos** (ADMIN pode promover a OWNER, auto-remoção sem proteção, índices faltando) e vários problemas médios/baixos.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `accept-organization-invitation.use-case.ts`: Qualquer usuário autenticado pode aceitar convite de outro
- **Arquivo:** `apps/api/src/modules/organizations/application/use-cases/accept-organization-invitation.use-case.ts`
- **Problema:** O `invitation.email` nunca é verificado contra o email do usuário autenticado. Usuário A que obtém o token de convite de B pode juntar-se à organização no papel de B (incluindo OWNER).
- **Correção:** Buscar o email do `userId` autenticado e comparar com `invitation.email` antes de prosseguir.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `update-member-role.use-case.ts`: ADMIN pode promover a OWNER sem validação no use case
- **Problema:** `ROLES_ASSIGN` é o guard de capability, mas se futuramente ADMIN receber `ROLES_ASSIGN`, poderá promover qualquer membro a OWNER sem restrição adicional. O convite de OWNER tem a verificação defensiva — `updateMemberRole` não tem.
- **Correção:** Adicionar validação explícita no use case: se `newRole === 'OWNER'`, verificar que o ator tem `ROLES_ASSIGN`.

#### A2 — `remove-organization-member.use-case.ts`: Auto-remoção sem proteção
- **Problema:** Nenhuma verificação impede que um usuário remova sua própria membership usando `DELETE /organizations/:orgId/members/:memberId`.
- **Correção:** Passar `actorId` no command e lançar `CannotRemoveSelfError` se `actorMember.id === command.memberId`.

#### A3 — Falta de índices em `OrganizationMember`
- **Problema:** `listActiveMembers` (`WHERE organizationId = ? AND status = 'ACTIVE'`) e `countActiveOwners` (`WHERE organizationId = ? AND role = 'OWNER' AND status = 'ACTIVE'`) operam sem índice adequado, causando full scan em organizações grandes.
- **Correção:** Adicionar `@@index([organizationId, status])` e `@@index([organizationId, role, status])` no schema Prisma.

---

### MÉDIO

#### M1 — `prisma-organization-invitation.repository.ts:49`: Leitura de convite fora da transação em `markInvitationUsed`
- **Problema:** `invitation.role` e `invitation.organizationId` lidos fora da transação. Uma revogação concorrente entre a leitura e o UPDATE cria membro com dados stale.
- **Correção:** Mover `findUniqueOrThrow` para dentro da transação e adicionar `revokedAt: null` no WHERE do updateMany.

#### M2 — `invite-organization-member.use-case.ts:72`: Convites duplicados para mesmo email
- **Problema:** Detecta se email já é membro ativo, mas não detecta convite pendente. ADMINs podem criar dezenas de tokens válidos para o mesmo email.
- **Correção:** Adicionar `findPendingInvitationByEmail` ao repositório e revogar/reusar antes de criar novo.

#### M3 — `invite-organization-member.use-case.ts:73`: Email não normalizado (lowercase)
- **Problema:** Identity normaliza emails, organizations não. Convite para `John@Example.COM` não detecta membro `john@example.com`.
- **Correção:** `const normalizedEmail = command.email.toLowerCase().trim()`.

#### M4 — `revoke-organization-invitation.use-case.ts:36`: Revogar convite já usado cria estado inconsistente
- **Problema:** Verificação considera apenas `isRevoked`, não `isUsed`. Convite já aceito pode ter `revokedAt` definido junto com `usedAt`.
- **Correção:** `if (invitation.isRevoked || invitation.isUsed) return;`

#### M5 — `organization-members.controller.ts:93`: `GET /members` exige `MEMBERS_MANAGE`
- **Problema:** Roles como `EVENT_MANAGER` e `CHECK_IN_STAFF` não têm `MEMBERS_MANAGE` e não conseguem listar membros da organização.
- **Correção:** Adicionar `MEMBERS_VIEW` capability a todos os roles, ou usar apenas `OrganizationRoleGuard` nessa rota.

#### M6 — `organization-members.controller.ts:139,164`: `DELETE` retornando 200 + body
- **Correção:** Mudar para `@HttpCode(204)` e remover body de resposta.

#### M7 — `create-organization.use-case.ts:32`: Slug vaza em mensagem de erro 409
- **Problema:** `super(\`Slug already in use: ${slug}\`)` exposto diretamente como `ConflictException(err.message)`. Permite enumeração de slugs existentes.
- **Correção:** Usar mensagem genérica `'Slug already in use'` sem o valor.

#### M8 — `invite-organization-member.use-case.ts:107`: `rawToken` em `logger.log` — exposto em produção
- **Correção:** Mudar para `logger.debug` ou condicionalmente por `NODE_ENV !== 'production'`.

#### M9 — `dtos/accept-invitation.dto.ts`: DTO não utilizado (código morto)
- **Correção:** Remover o arquivo.

#### M10 — `organization-role.guard.ts`: Duas queries por request (suspension + membership)
- **Sugestão:** Combinar em query única ou adicionar cache curto (Redis 30s).

---

### BAIXO

#### B1 — `create-organization.dto.ts`: `name` aceita strings de apenas whitespace
#### B2 — `organization.entity.ts`: `status` e `role` como `string` solto sem type safety
#### B3 — `organization-members.controller.ts:100`: `userId` interno exposto na listagem de membros
#### B4 — Guard retorna 403 para org inexistente (comportamento válido por segurança, mas não documentado)

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| C1 | `accept-organization-invitation.use-case.ts`: email do usuário autenticado buscado e comparado (case-insensitive) com `invitation.email`. Lança `OrganizationAccessDeniedError` se não bater. Specs atualizadas para cobrir o cenário. | `accept-organization-invitation.use-case.ts`, spec |
| M7 | Slug não é mais exposto em `ConflictException` — mensagem genérica `'Slug already in use'`. | `create-organization.use-case.ts` |
| M8 | `rawToken` movido de `logger.log` para `logger.debug`. | `invite-organization-member.use-case.ts` |

**Pendente:**
- A1: ADMIN pode promover a OWNER sem validação adicional no use case
- ~~A2: Auto-remoção sem proteção~~ — **CORRIGIDO 2026-08-25**: `CannotRemoveSelfError` adicionado em `organization.errors.ts`. `removeMemberAtomically` agora recebe `actorUserId` e verifica `member.userId === actorUserId` dentro da transação. Use case, port e controller atualizados. Spec adiciona caso para `CannotRemoveSelfError`.
- A3: Índices compostos faltando em `organization_members`
- ~~M1: `markInvitationUsed` — leitura fora de transação~~ — **CORRIGIDO 2026-08-25**: `findUniqueOrThrow` movido para dentro da transação; `updateMany` agora inclui `revokedAt: null` além de `usedAt: null` — impede criação de membro a partir de convite concorrentemente revogado
- M2: Convites duplicados para mesmo email
- ~~M3: Email não normalizado (lowercase) na criação de convite~~ — **CORRIGIDO 2026-08-25**: `normalizedEmail = command.email.toLowerCase().trim()` adicionado no início de `execute`. Todos os usos de `command.email` substituídos por `normalizedEmail`.
- ~~M4: `revogar` convite já usado não verifica `isUsed`~~ — **CORRIGIDO 2026-08-25**: `revoke-organization-invitation.use-case.ts` — guard atualizado para `if (invitation.isRevoked || invitation.isUsed) return;`
- M5: `GET /members` exige `MEMBERS_MANAGE` — exclui roles que deveriam ter acesso
- M6: `DELETE` retornando 200 em vez de 204
