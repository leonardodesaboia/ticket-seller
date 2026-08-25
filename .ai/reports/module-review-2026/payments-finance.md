# Revisão de Módulo — payments + finance

**Data:** 2026-08-24  
**Revisor:** Claude Sonnet 4.6 (análise automatizada)  
**Status:** Documentado — correções em andamento

---

## Resumo Executivo

Os módulos `payments` e `finance` são o núcleo financeiro do sistema. A análise identificou **1 problema crítico**, **7 altos**, **8 médios** e **2 baixos**. Os problemas mais graves envolvem: ledger double-entry desbalanceado (processingFee ausente), IDOR no endpoint de refund, e race conditions no payout webhook.

---

## Problemas por Severidade

### CRÍTICO

#### C1 — `payout-webhook.controller.ts`: Sem try/catch — erros de assinatura viram 500
- **Arquivo:** `apps/api/src/modules/finance/presentation/controllers/payout-webhook.controller.ts`
- **Problema:** Qualquer exceção durante `parseWebhookEvent` (ex: JSON malformado) resulta em 500 com stack trace exposto. `payment-webhook.controller.ts` já tem try/catch adequado.
- **Correção:** Envolver execute em try/catch, mapear `UnauthorizedException` para 401 e erros inesperados para 400 sem vazar detalhes.
- **Status:** PENDENTE

---

### ALTO

#### A1 — `record-refund.use-case.ts`: Ledger desbalanceado — processingFeeAmount ausente
- **Arquivo:** `apps/api/src/modules/finance/application/use-cases/record-refund.use-case.ts`
- **Problema:** Na política `REFUND`, DEBIT em SELLER_PAYABLE usa `grossAmount`, mas CREDIT em PLATFORM_REVENUE usa apenas `platformFeeAmount` sem incluir `processingFeeAmount`. O invariante de double-entry vai falhar em runtime. Mesmo problema na política `PROPORTIONAL`.
- **Correção:** Somar `platformFeeAmount + processingFeeAmount` no CREDIT de `PLATFORM_REVENUE`. Incluir `scaledProcessingFee` na política `PROPORTIONAL`.
- **Status:** PENDENTE

#### A2 — `record-chargeback.use-case.ts`: Balance decrementado sem verificar se já foi settled
- **Arquivo:** `apps/api/src/modules/finance/application/use-cases/record-chargeback.use-case.ts`
- **Problema:** Sempre decrementa `available`, mas se o chargeback chegar antes do settlement, deveria decrementar `pending`. Pode deixar `available` negativo.
- **Correção:** Verificar existência de `balance_settlement` para o pedido antes de decrementar `pending` vs `available`.
- **Status:** PENDENTE

#### A3 — `order-refund.controller.ts`: IDOR — qualquer usuário autenticado pode tentar refund de qualquer org
- **Arquivo:** `apps/api/src/modules/payments/presentation/controllers/order-refund.controller.ts`
- **Problema:** Apenas `ActorGuard` aplicado. Sem `OrganizationRoleGuard` nem `RequireCapability`. Usuário pode passar qualquer `orgId` na URL.
- **Correção:** Adicionar `@UseGuards(ActorGuard, OrganizationRoleGuard)` e capability adequada.
- **Status:** PENDENTE

#### A4 — `finance.controller.ts`: `orgId` sem `ParseUUIDPipe`
- **Arquivo:** `apps/api/src/modules/finance/presentation/controllers/finance.controller.ts`
- **Problema:** `@Param('orgId') orgId: string` sem validação UUID em todos os handlers.
- **Correção:** `@Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string`
- **Status:** PENDENTE

#### A5 — `process-payout-webhook.use-case.ts`: Race condition — status terminal verificado fora de transação
- **Arquivo:** `apps/api/src/modules/finance/application/use-cases/process-payout-webhook.use-case.ts`
- **Problema:** Dois webhooks concorrentes (SUCCEEDED e FAILED) podem ambos passar no guard de status terminal e entrar em suas transações. O payout pode terminar em estado não-determinístico.
- **Correção:** Dentro de `handleSucceeded`/`handleFailed`, após dedup INSERT, fazer `SELECT ... FOR UPDATE` no payout e revalidar status.
- **Status:** PENDENTE

#### A6 — Sem testes para `record-sale.use-case.ts` e `record-refund.use-case.ts`
- **Problema:** Lógica de double-entry crítica sem cobertura de testes. O bug A1 passaria despercebido.
- **Correção:** Criar specs verificando `sum(DEBIT) === sum(CREDIT)` para cada política.
- **Status:** PENDENTE

#### A7 — `create-payment-attempt.use-case.ts`: Race condition entre check e createPayment
- **Arquivo:** `apps/api/src/modules/payments/application/use-cases/create-payment-attempt.use-case.ts`
- **Problema:** `findActiveByOrderId` e `gateway.createPayment` não estão na mesma transação. Dois requests concorrentes podem criar dois PaymentAttempts para o mesmo pedido.
- **Correção:** Adicionar constraint `UNIQUE PARTIAL` no banco: `CREATE UNIQUE INDEX ON payment_attempts (order_id) WHERE status IN ('PENDING', 'PROCESSING')`.
- **Status:** PENDENTE

---

### MÉDIO

#### M1 — `process-payment-webhook.use-case.ts`: quantity pode ser string (Prisma $queryRaw)
- **Problema:** `unitIndex < item.quantity` com quantity string retorna false para todo unitIndex. Nenhum ticket emitido sem erro.
- **Correção:** `Number(item.quantity)` explicitamente.

#### M2 — `settle-order.use-case.ts`: pending_amount pode ir negativo
- **Correção:** Adicionar `WHERE pending_amount >= ${sellerNetAmount}` e verificar rows affected.

#### M3 — `finance.controller.ts`: `limit` aceita `NaN`
- **Correção:** Validar com `/^\d+$/` antes de `Number(limit)`.

#### M4 — `settlement.worker.ts`: Drain-loop sem flag isRunning — execuções sobrepostas
- **Correção:** Adicionar `isRunning` flag como feito em `outbox-notification.worker.ts`.

#### M5 — `reconciliation.worker.ts`: Múltiplas instâncias processam mesmos payouts
- **Problema:** SELECT sem `FOR UPDATE SKIP LOCKED` traz mesmos registros para todos os pods.
- **Correção:** Envolver em transação curta com `FOR UPDATE SKIP LOCKED`.

#### M6 — `reconciliation.worker.ts`: handleSucceeded/handleFailed sem recheck de status terminal
- **Correção:** `SELECT ... FOR UPDATE` no payout dentro da transação, validar status antes de atualizar.

#### M7 — `list-ledger-transactions.use-case.ts`: Falta índice composto para cursor
- **Correção:** `CREATE INDEX ON ledger_entries (account_id, occurred_at DESC)`.

#### M8 — `record-refund.use-case.ts`: findOrCreateOrgAccount — gap entre INSERT e SELECT
- **Correção:** `INSERT ... ON CONFLICT DO UPDATE SET updated_at = NOW() RETURNING *`.

---

### BAIXO

#### B1 — `finance.controller.ts`: `idempotencyKey` sem `@IsUUID('4')`
#### B2 — `process-refund.use-case.ts`: `refundedAmount` como `number` em vez de `string`

---

## Correções Implementadas

**2026-08-24 — Sessão 2**

| ID | Correção | Arquivo |
|---|---|---|
| A3 | IDOR: `order-refund.controller.ts` agora tem `@UseGuards(ActorGuard, OrganizationRoleGuard)` e `@RequireCapability(OrganizationCapability.PAYOUT_REQUEST)`. `payments.module.ts` atualizado com provider do guard. | `order-refund.controller.ts`, `payments.module.ts` |
| A4 | `finance.controller.ts`: todos os `@Param('orgId')` usam `new ParseUUIDPipe({ version: '4' })`. Parâmetro `limit` validado (1–200, `BadRequestException` se NaN). `CreatePayoutBody.idempotencyKey` usa `@IsUUID('4')`. | `finance.controller.ts` |

**Pendente:**
- ~~C1: `payout-webhook.controller.ts` sem try/catch~~ — **JÁ CORRIGIDO**
- ~~A1: `record-refund.use-case.ts` — ledger desbalanceado~~ — **JÁ CORRIGIDO**: `totalPlatformFee = platformFeeAmount + processingFeeAmount` em todas as 3 políticas (RETAIN, REFUND, PROPORTIONAL)
- A2: `record-chargeback.use-case.ts` — decrementa `available` sem verificar se settled
- ~~A5: Race condition no `process-payout-webhook.use-case.ts`~~ — **CORRIGIDO 2026-08-25**: `SELECT ... FOR UPDATE` após dedup INSERT nos handlers `handleSucceeded` e `handleFailed`, revalida status antes de mutar
- A6: Sem testes para `record-sale` e `record-refund`
- A7: Race condition em `create-payment-attempt` (constraint `UNIQUE PARTIAL` faltando)
- ~~M2: `settle-order` — `pending_amount` pode ir negativo~~ — **CORRIGIDO 2026-08-25**: `WHERE pending_amount >= ${sellerNetAmount}` adicionado; 0 rows → log warning (refund pode ter ajustado saldo)
- ~~M4: `settlement.worker.ts` drain-loop sem flag `isRunning`~~ — **CORRIGIDO 2026-08-25**: flag `isRunning` + `finally` adicionados
- ~~M5/M6: `reconciliation.worker.ts`~~ — **CORRIGIDO 2026-08-25**: `FOR UPDATE SKIP LOCKED` em `fetchStuckPayouts`, `isRunning` flag, `SELECT ... FOR UPDATE` + status recheck em `handleSucceeded`/`handleFailed`
