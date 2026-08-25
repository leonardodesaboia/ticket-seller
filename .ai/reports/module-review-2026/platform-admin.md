# Revisão de Módulo — platform-admin

**Data:** 2026-08-25
**Revisor:** Claude Sonnet 4.6 (análise automatizada)
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

O módulo `platform-admin` controla as operações mais privilegiadas da plataforma. A estrutura geral é sólida: `PlatformRoleGuard` funciona corretamente com hierarquia numérica e consulta ao banco, audit log presente em todas as ações, operações de suspensão são idempotentes.

Foram identificados **2 bloqueantes**, **4 altos**, **5 médios** e **3 baixos**.

---

## Problemas por Severidade

### BLOQUEANTE

#### BL1 — `block-payout.use-case.ts:19-37`: Race condition TOCTOU — payout pode ser bloqueado após execução

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/block-payout.use-case.ts`
**Trecho:** linhas 19–37
**Problema:** O padrão `findUnique` + `update` não é atômico. Entre a leitura do status e a escrita de `BLOCKED`, um worker de settlement pode avançar o payout de `PROCESSING` para `SUCCEEDED`. O `update` final não valida o status atual — sobrescreve qualquer valor com `BLOCKED`, inclusive estados terminais como `SUCCEEDED` ou `PAID`.
**Impacto:** Inconsistência financeira irrecuperável entre estado do sistema e estado financeiro real. Payout já executado aparece como bloqueado.
**Correção recomendada:** Substituir por `updateMany` com `where` composto `{ id, status: { in: BLOCKABLE_STATUSES } }` e verificar `result.count === 0` para distinguir "não encontrado" de "status inválido". Alternativamente, usar `$transaction` com `SELECT FOR UPDATE`.

---

#### BL2 — `admin.controller.ts:26-27`: Ausência total de rate limiting em todas as rotas de admin

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/platform-admin/presentation/controllers/admin.controller.ts`
**Trecho:** declaração do controller
**Problema:** Nenhuma rota aplica `@Throttle` ou `SmartThrottlerGuard`. Um token de `PLATFORM_SUPPORT` comprometido pode exfiltrar toda a base de usuários e orgs via paginação em loop sem qualquer limitação de velocidade. Ações destrutivas em massa (suspensão de múltiplas orgs) também ficam sem proteção.
**Impacto:** Exfiltração completa de dados em caso de comprometimento de credencial de suporte. Sem fricção para abuso de operações administrativas.
**Correção recomendada:** Aplicar `@UseGuards(SmartThrottlerGuard)` no controller com throttle conservador para ações (ex: 10/min) e mais permissivo para listagens (ex: 60/min).

---

### ALTO

#### A1 — Violação de arquitetura hexagonal: todos os use cases injetam `PrismaService` diretamente

**Classificação:** ALTO
**Arquivo:** todos os use cases em `application/use-cases/`
**Trecho:** construtores de todos os use cases
**Problema:** Todos os 8 use cases do módulo injetam `PrismaService` na camada de aplicação. Viola ports & adapters, acopla use cases à implementação Prisma e cria precedente inconsistente com a correção já feita no módulo identity (que criou `IUserRepository`).
**Impacto:** Camada de aplicação não é testável sem mock completo do Prisma. Violação arquitetural documentada como padrão proibido em AGENTS.md.
**Correção recomendada:** Criar ports `IAdminUserRepository`, `IAdminOrganizationRepository`, `IAdminPayoutRepository` com adapters Prisma em `infrastructure/repositories/`.

---

#### A2 — `list-admin-users.use-case.ts:40-41`: PII e mapa de privilégios expostos a PLATFORM_SUPPORT

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/list-admin-users.use-case.ts`
**Trecho:** linhas 40–41 (select de `email` e `platformRole`)
**Problema:** A listagem retorna `email` (PII direto) e `platformRole` (revela quais usuários são admins) para qualquer `PLATFORM_SUPPORT`. Um support comprometido pode mapear todos os admins da plataforma e exfiltrar emails de todos os usuários.
**Impacto:** Violação de princípio de mínimo privilégio. Facilita ataques direcionados contra administradores.
**Correção recomendada:** Remover ou mascarar `email` para PLATFORM_SUPPORT. Remover ou ocultar `platformRole` para PLATFORM_SUPPORT — expor apenas para PLATFORM_ADMIN.

---

#### A3 — `list-admin-organizations` e `list-admin-users`: Cursor de paginação baseado em `createdAt` — colisão silenciosa

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/list-admin-organizations.use-case.ts`, `list-admin-users.use-case.ts`
**Trecho:** lógica de cursor
**Problema:** Se múltiplos registros têm o mesmo `createdAt` (imports em lote, scripts), a query `lt: new Date(cursor)` pula silenciosamente todos os registros com o mesmo timestamp. Cursor malformado produz `Invalid Date` sem validação — pode resultar em query sem filtro retornando todos os registros.
**Impacto:** Admin pode acreditar ter revisado todos os registros quando vários foram omitidos silenciosamente. Cursor inválido pode retornar dados inesperados.
**Correção recomendada:** Cursor baseado em `id` opaco (base64 de `{ id, createdAt }`), ou paginação offset para dados administrativos. Adicionar validação de formato do cursor antes de parsear.

---

#### A4 — `platform-role.guard.ts:29-30`: Guard silencioso quando `@RequirePlatformRole` está ausente

**Classificação:** ALTO
**Arquivo:** `apps/api/src/platform/http/guards/` (guard de plataforma)
**Trecho:** branch de metadata ausente
**Problema:** Se um desenvolvedor adicionar rota ao `AdminController` sem `@RequirePlatformRole`, o guard retorna `true` sem nenhuma verificação de papel. A falha é silenciosa — nenhum erro, qualquer usuário autenticado acessa a rota.
**Impacto:** Exposição acidental de endpoints administrativos sem proteção de papel.
**Correção recomendada:** Inverter o padrão: sem `@RequirePlatformRole` em contexto de admin, o guard deve rejeitar. Aplicar `@RequirePlatformRole(PlatformRole.PLATFORM_SUPPORT)` no nível da classe como mínimo obrigatório.

---

### MÉDIO

#### M1 — `unsuspend-organization.use-case.ts` e `unsuspend-user.use-case.ts`: `findUnique` sem `select`

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/unsuspend-organization.use-case.ts`, `unsuspend-user.use-case.ts`
**Trecho:** linhas 17–20 e 17–19
**Problema:** Carrega todos os campos da entidade quando apenas `id` é necessário para verificar existência. Inconsistente com o padrão adotado nos use cases de suspend.
**Impacto:** Tráfego desnecessário entre aplicação e banco. Risco de vazamento de campo futuro ao retornar entidade completa.
**Correção recomendada:** Adicionar `select: { id: true }`.

---

#### M2 — `unsuspend-organization` e `unsuspend-user`: Operação não idempotente

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/unsuspend-organization.use-case.ts`, `unsuspend-user.use-case.ts`
**Trecho:** lógica de update
**Problema:** Os use cases de suspend têm verificação explícita de idempotência. Os de unsuspend chamam `update` diretamente mesmo se `suspendedAt` já for `null`, gerando log de auditoria para ação que não teve efeito real.
**Impacto:** Logs de auditoria poluídos com operações sem efeito, dificultando auditoria forense.
**Correção recomendada:** Verificar `suspendedAt` antes do update e retornar early com log de noop, seguindo o padrão dos use cases de suspend.

---

#### M3 — `get-platform-dashboard.use-case.ts:30-31`: `event.count()` sem filtro de status

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/get-platform-dashboard.use-case.ts`
**Trecho:** linhas 30–31
**Problema:** `organization.count` e `user.count` filtram por `deletedAt: null`, mas `event.count()` não aplica filtro algum, incluindo eventos deletados/cancelados no total — métrica inflada no dashboard.
**Impacto:** Dashboard exibe contagem enganosa de eventos ativos para administradores da plataforma.
**Correção recomendada:** Verificar o schema do modelo `Event` e aplicar filtros equivalentes (`deletedAt: null` ou `status: { not: 'CANCELLED' }`).

---

#### M4 — `suspend-organization.use-case.ts:37-40`: Suspensão não invalida sessões ativas dos membros

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/suspend-organization.use-case.ts`
**Trecho:** linhas 37–40
**Problema:** Ao suspender uma org, apenas `suspendedAt` é setado. Membros com sessões ativas continuam operando em endpoints que não passam pelo `OrganizationRoleGuard` (ex: endpoints sem `orgId` no path, workers, webhooks).
**Impacto:** Suspensão de org não é imediata para sessões já estabelecidas. Membros podem continuar operando por até 15 minutos (TTL do access token).
**Correção recomendada:** Avaliar revogação de sessões dos membros via `sessionRepository.revokeAllForOrganization`, ou documentar explicitamente como limitação conhecida com TTL aceitável.

---

#### M5 — `block-payout.use-case.spec.ts`: Testes não verificam log de auditoria nem falha de infra

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/platform-admin/application/use-cases/block-payout.use-case.spec.ts`
**Trecho:** suíte completa
**Problema:** Os testes cobrem fluxos de status mas não: (1) verificação de que `logger.log` é chamado com os campos corretos; (2) comportamento quando `prisma.payout.update` lança P2025 (registro deletado entre find e update).
**Impacto:** Regressões silenciosas em auditoria e falhas de infraestrutura não detectadas.
**Correção recomendada:** Adicionar testes para: log de auditoria com campos obrigatórios, e tratamento de P2025 (`NotFoundException`).

---

### BAIXO

#### B1 — `suspend.dto.ts`: `reason` sem `@MaxLength`

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/platform-admin/presentation/dtos/suspend.dto.ts`
**Trecho:** campo `reason`
**Problema:** `@MinLength(10)` presente mas sem teto. Input de 1MB seria processado, logado e passado ao banco.
**Impacto:** Potencial para payload excessivo em logs de auditoria.
**Correção recomendada:** Adicionar `@MaxLength(1000)`.

---

#### B2 — `admin.controller.ts`: `SuspendDto` reutilizado para unsuspend — nome enganoso

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/platform-admin/presentation/controllers/admin.controller.ts`
**Trecho:** uso de `SuspendDto` em rotas de unsuspend
**Problema:** O mesmo DTO é usado para suspend e unsuspend. O nome `SuspendDto` para a operação de remoção de suspensão é semanticamente incorreto, confundindo leitores futuros.
**Impacto:** Manutenção dificultada.
**Correção recomendada:** Renomear para `AdminActionReasonDto` e usar em ambas as operações.

---

#### B3 — `PlatformRoleGuard`: Query redundante ao banco — `platformRole` já poderia estar no `actor`

**Classificação:** BAIXO
**Arquivo:** guard de plataforma
**Trecho:** método `canActivate`
**Problema:** `ActorGuard` consulta o banco para `suspendedAt`. `PlatformRoleGuard` faz segunda query independente para `platformRole`. Duas queries para o mesmo usuário por request de admin.
**Impacto:** Latência desnecessária em cada request de admin.
**Correção recomendada:** Incluir `platformRole` no `ICurrentActor` e populá-lo no `ActorGuard` junto com `suspendedAt`. O `PlatformRoleGuard` leria do `actor` sem roundtrip adicional.

---

## Resumo

| Classificação | Quantidade |
|---|---|
| BLOQUEANTE | 2 |
| ALTO | 4 |
| MÉDIO | 5 |
| BAIXO | 3 |
| **Total** | **14** |

**Prioridade de correção:** BL1 (race condition financeira) → BL2 (rate limiting ausente) → A2 (PII/mapa de admins) → A4 (guard silencioso) → A1 (violação hexagonal) → A3 (cursor com colisão) → M2 (idempotência de unsuspend) → M4 (sessões ativas após suspensão)

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| BL1 | `block-payout.use-case.ts`: substituído `findUnique` + `update` por `updateMany` com `where: { id, status: { in: BLOCKABLE_STATUSES } }`. Verifica `result.count === 0` para distinguir not-found de status inválido. | `block-payout.use-case.ts` |
| BL2 | `admin.controller.ts`: `@UseGuards(ActorGuard, PlatformRoleGuard, SmartThrottlerGuard)` no nível da classe. `@AdminReadThrottle()` e `@AdminActionThrottle()` nas rotas individuais. | `admin.controller.ts` |
| B1 | `suspend.dto.ts`: `reason` agora tem `@MaxLength(1000)`. | `suspend.dto.ts` |

**Pendente:**
- A1: Layer violation — todos os use cases injetam `PrismaService` diretamente (criar `IAdminUserRepository`, `IAdminOrganizationRepository`, `IAdminPayoutRepository`)
- A2: `list-admin-users` expõe `email` e `platformRole` para `PLATFORM_SUPPORT`
- A3: Cursor de paginação baseado em `createdAt` — colisão silenciosa
- A4: Guard silencioso quando `@RequirePlatformRole` ausente
- M2: `unsuspend-*` não são idempotentes
- M3: `event.count()` sem filtro de status no dashboard
- M4: Suspensão não invalida sessões ativas dos membros
