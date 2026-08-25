# Revisão de Módulo — tickets + checkin + inventory

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

Os módulos `tickets`, `checkin` e `inventory` gerenciam emissão de ingressos, controle de acesso e estoque. A análise encontrou **2 críticos**, **6 altos**, **8 médios** e **4 baixos**. O problema mais grave é o IDOR em `findByClaimTokenHash` que permite aceitação cross-tenant de transferências, e o vazamento cross-tenant em `findByIdempotencyKey` de check-ins.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `prisma-ticket-transfer.repository.ts:57`: IDOR — `findByClaimTokenHash` sem `organization_id`
- **Arquivo:** `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts`
- **Problema:** Query não filtra por `organization_id`. Um atacante com token legítimo da org A pode aceitá-lo como scanner da org B, criando transferência cross-tenant.
- **Correção:** Adicionar `AND organization_id = ${organizationId}::uuid` e passar `organizationId` na assinatura do método.
- **Status:** PENDENTE

#### C2 — `prisma-check-in.repository.ts:61`: `findByIdempotencyKey` sem filtro de `organization_id`
- **Arquivo:** `apps/api/src/modules/checkin/infrastructure/repositories/prisma-check-in.repository.ts`
- **Problema:** Operador da org B pode usar a mesma `idempotency-key` da org A e receber resultado de check-in de outra org, incluindo `decision`, `allowed`, `checkedInAt` — vazamento de dados cross-tenant.
- **Correção:** Adicionar `AND organization_id = ${organizationId}::uuid` e passar `organizationId`.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `cancel-transfer.use-case.ts` + `repository:83`: UPDATE sem `AND status='PENDING'`
- **Problema:** Se transfer já foi aceito entre `findPendingByTicketId` e `cancel`, o UPDATE sobrescreve `ACCEPTED` para `CANCELLED`, corrompendo histórico.
- **Correção:** `UPDATE ticket_transfers SET status = 'CANCELLED' WHERE id = ${id}::uuid AND status = 'PENDING'` e verificar `affected === 0`.

#### A2 — `accept-transfer.use-case.ts:34`: `isExpired()` verificado fora da transação — TOCTOU
- **Problema:** Se token expirar entre a verificação no use case e `acceptAtomically`, a aceitação prossegue.
- **Correção:** Adicionar `AND expires_at > NOW()` na query de re-verificação dentro do `acceptAtomically`.

#### A3 — `prisma-inventory.repository.ts:134`: `getAvailability` vs `tryReserve` — fontes de verdade diferentes
- **Problema:** `tryReserve` usa `ticket_inventory.reserved`, `getAvailability` usa JOIN em `reservations` ativas. Divergência pode mostrar 0 disponível no GET mas sucesso no `tryReserve`, ou vice-versa.
- **Correção:** Unificar a fonte de verdade — escolher uma abordagem e documentar.

#### A4 — `prisma-inventory.repository.ts:74`: `initializeForEvent` sem transação
- **Problema:** Comment no port diz "Must execute inside a transaction" mas implementação não garante isso. Falha no meio deixa inventário parcial.
- **Correção:** Envolver em `$transaction` e usar INSERT multi-row.

#### A5 — `prisma-ticket-credential.repository.ts:51`: `findByTokenHash` sem `organization_id`
- **Problema:** Método público sem scoping de tenant. Uso incorreto futuro vazaria credenciais entre orgs.
- **Correção:** Adicionar `organizationId` como parâmetro obrigatório ou remover e usar apenas o adapter scoped.

#### A6 — Testes ausentes em módulos críticos
- **Problema:** `get-ticket-credential`, `prisma-ticket-transfer.repository` (incluindo `acceptAtomically`), `prisma-ticket-credential.repository` (incluindo `rotateCredential`), `prisma-inventory.repository`, `PrismaCheckInRepository` sem testes.

---

### MÉDIO

#### M1 — `accept-transfer.use-case.ts`: Endpoint público sem rate-limit
- **Problema:** `POST /public/transfers/:claimToken/accept` sem `@Throttle()`. Força-bruta de tokens possível.
- **Correção:** Adicionar rate-limit agressivo por IP (ex: 10 req/h).

#### M2 — `issue-ticket-credential.use-case.ts:55`: Versioning incorreto no fallback de race condition
- **Problema:** Se `createIfNoneActive` falha por conflito e cai no `rotateCredential`, a `version` calculada ainda é `1` em vez de `existente.version + 1`, podendo gerar duplicidade de versão.
- **Correção:** Em `rotateCredential`, recalcular versão com `SELECT MAX(version) + 1` dentro da transação.

#### M3 — `initiate-transfer.use-case.ts`: Não verifica ticket CANCELLED antes de criar transfer
- **Problema:** Ticket cancelado pode ter transfer criado, ficando `PENDING` até expirar sem possibilidade de aceite.
- **Correção:** Verificar `ticket.status === 'CANCELLED'` e lançar erro específico.

#### M4 — `prisma-inventory.repository.ts:117`: `releaseHold` silencia underflow com `GREATEST`
- **Problema:** `GREATEST(reserved - quantity, 0)` mascarar discrepâncias silenciosamente. Se `reserved = 3` e libera 10, perde-se a informação que 7 unidades foram "perdidas".
- **Correção:** Adicionar `AND reserved >= ${quantity}` e verificar `affected === 0`.

#### M5 — `perform-check-in.use-case.ts:125`: `isUniqueViolation` não distingue qual constraint
- **Problema:** Se `idempotency_key` unique constraint viola (deveria ser replay), código responde com `ALREADY_CHECKED_IN` em vez de propagar o erro.
- **Correção:** Verificar `error.meta?.target` para distinguir qual constraint violou.

#### M6 — `public-transfer-accept.controller.ts`: Resposta sem `Cache-Control: no-store`
- **Problema:** `newCredentialToken` (segredo de acesso) pode ser cacheado por browser/proxy.
- **Correção:** Adicionar header `Cache-Control: no-store, private` na resposta.

#### M7 — `ticket.entity.ts:32`: Validação de `publicCode` apenas por length
- **Correção:** `/^[0-9a-f]{64}$/i.test(props.publicCode)`.

#### M8 — `public-availability.controller.ts:6`: `stale-while-revalidate=30` muito longo
- **Problema:** Para eventos com poucos ingressos, compradores podem tentar comprar ingressos já esgotados durante os 30s de stale.
- **Correção:** Reduzir para `stale-while-revalidate=5` ou remover.

---

### BAIXO

#### B1 — `order.entity.ts` (tickets): `REFUNDED` ausente do tipo `OrderStatus`
#### B2 — `check-in.controller.ts`: HTTP 200 para todos os resultados sem documentação
#### B3 — `prisma-order-cancellation.repository.ts:240`: Comentário `// 4.` pula `// 3.`
#### B4 — `GetEventAttendanceUseCase`: `totalIssued === 0` não testado (divisão por zero)

---

## Correções Implementadas

**2026-08-24 — Sessão 2 e 3**

| ID | Correção | Arquivo |
|---|---|---|
| C2 | `prisma-check-in.repository.ts`: `findByIdempotencyKey` agora recebe `organizationId` e filtra por `AND organization_id = ${organizationId}::uuid`. Port e use-case atualizados. | `prisma-check-in.repository.ts`, `check-in-repository.port.ts`, `perform-check-in.use-case.ts` |
| A2 | `prisma-ticket-transfer.repository.ts`: `acceptAtomically` agora tem `FOR UPDATE` no SELECT do transfer dentro da transação e verifica `expires_at <= NOW()` relançando `TransferExpiredError`. | `prisma-ticket-transfer.repository.ts` |
| A4 | `prisma-inventory.repository.ts`: `initializeForEvent` envolto em `this.prisma.$transaction()`. | `prisma-inventory.repository.ts` |

**Pendente:**
- ~~C1: `findByClaimTokenHash` sem `organization_id`~~ — **FALSO POSITIVO**: o endpoint `POST /public/transfers/:claimToken/accept` é intencionalmente público (sem auth/tenant context). O claim token é 256-bit aleatório (segurança por obscuridade suficiente). `acceptAtomically` usa `transfer.organizationId` do registro do banco — correto. Sem `orgId` disponível no request para filtrar.
- ~~A1: `cancel-transfer` UPDATE sem `AND status='PENDING'`~~ — **JÁ CORRIGIDO**: `prisma-ticket-transfer.repository.ts:86` já tem `AND status = 'PENDING'` e verifica `affected === 0`.
- A3: `getAvailability` vs `tryReserve` — fontes de verdade diferentes
- ~~A5: `findByTokenHash` em `prisma-ticket-credential` sem `organization_id`~~ — **CORRIGIDO 2026-08-25**: port atualizado para `findByTokenHash(tokenHash, organizationId)`. Query adiciona `AND organization_id = ${organizationId}::uuid`. Corrigido antes de ter callers — porta segura para uso futuro.
- A6: Testes ausentes em repositórios críticos
- M1: Endpoint público de accept-transfer sem rate-limit
- M4: `releaseHold` silencia underflow com `GREATEST`
- M8: `stale-while-revalidate=30` muito longo em availability
