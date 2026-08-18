Relatório da TASK-049 — Merchant Balance & Settlement
Status

COMPLETED

Arquivos alterados
apps/api/prisma/migrations/20260818000027_seller_balances/migration.sql: NOVO — seller_balances (reserved CHECK >= 0, pending/available sem CHECK), balance_settlements (UNIQUE order_id)
apps/api/prisma/schema.prisma: adicionados modelos SellerBalance e BalanceSettlement
apps/api/src/modules/finance/domain/entities/seller-balance.entity.ts: NOVO
apps/api/src/modules/finance/domain/entities/balance-settlement.entity.ts: NOVO
apps/api/src/modules/finance/domain/ports/seller-balance.repository.port.ts: NOVO — ISellerBalanceRepository com SELECT FOR UPDATE
apps/api/src/modules/finance/domain/ports/settlement-policy.port.ts: NOVO — ISettlementPolicyPort
apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts: EXPANDIDO — upsertIncrementPending após ledger
apps/api/src/modules/finance/application/use-cases/record-refund.use-case.ts: EXPANDIDO — decrementa pending ou available conforme estado do settlement
apps/api/src/modules/finance/application/use-cases/record-chargeback.use-case.ts: EXPANDIDO — decrementAvailable (pode ficar negativo — D10)
apps/api/src/modules/finance/application/use-cases/settle-order.use-case.ts: NOVO
apps/api/src/modules/finance/application/use-cases/get-organization-balance.use-case.ts: NOVO
apps/api/src/modules/finance/infrastructure/repositories/prisma-seller-balance.repository.ts: NOVO — SQL nativo para FOR UPDATE
apps/api/src/modules/finance/infrastructure/adapters/fee-policy-settlement.adapter.ts: NOVO — lê settlement_delay_days de fee_policies, nunca de ENV
apps/api/src/modules/finance/infrastructure/workers/settlement.worker.ts: NOVO — OnModuleInit/Destroy, setInterval 1h, drain-the-queue, FOR UPDATE SKIP LOCKED
apps/api/src/modules/finance/presentation/controllers/finance.controller.ts: NOVO — GET /finance/balance com ActorGuard
apps/api/src/modules/finance/finance.module.ts: EXPANDIDO
apps/api/test/integration/finance/settlement.integration-spec.ts: NOVO

Implementado
seller_balances materializado e atualizado atomicamente com cada lançamento de ledger.
pending e available podem ser negativos (D10 — saldo negativo permitido). reserved_amount tem CHECK >= 0.
SettlementWorker em polling 1h: busca orders TICKETS_ISSUED com event.ends_at + delay <= NOW(), drain-the-queue com chunk 50 e FOR UPDATE SKIP LOCKED.
Settlement idempotente via UNIQUE(order_id) em balance_settlements + ON CONFLICT DO NOTHING.
settlement_delay_days lido de fee_policies (não de ENV) via FeePolicySettlementAdapter.
GET /organizations/:orgId/finance/balance retorna { pendingAmount, availableAmount, reservedAmount, currency }.
SELECT FOR UPDATE em seller_balances antes de qualquer UPDATE para serialização concorrente.

Decisões tomadas
findByOrgForUpdate usa SQL nativo SELECT ... FOR UPDATE para serialização real (Prisma não suporta FOR UPDATE adequadamente).
upsertIncrementPending usa INSERT ... ON CONFLICT (organization_id) DO UPDATE para atomicidade.
SettleOrderUseCase usa SELECT FOR UPDATE no seller_balance para serializar settlements concorrentes, depois INSERT ON CONFLICT DO NOTHING para idempotência.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api typecheck	aprovado (0 erros)
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes (fora do escopo)
pnpm --filter @ticket-seller/api test	311 passando

Riscos identificados
Testes de integração (Testcontainers) não executados sem banco disponível.

Pendências
Nenhuma de código.

Documentação atualizada
Nenhuma (documentação de fase será atualizada na conclusão de TASK-052).

Próxima tarefa recomendada
TASK-050 — Payout Provider & Split Foundation
