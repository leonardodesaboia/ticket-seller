Relatório da TASK-052 — Financial Dashboard & Reconciliation
Status

COMPLETED

Arquivos alterados
Backend (apps/api/):
apps/api/src/modules/finance/application/use-cases/get-financial-summary.use-case.ts: NOVO — agrega ledger_entries por período + lê seller_balances
apps/api/src/modules/finance/application/use-cases/get-financial-summary.use-case.spec.ts: NOVO — 5 testes
apps/api/src/modules/finance/application/use-cases/list-ledger-transactions.use-case.ts: NOVO — keyset pagination (occurredAt DESC, id DESC)
apps/api/src/modules/finance/application/use-cases/list-ledger-transactions.use-case.spec.ts: NOVO — 5 testes
apps/api/src/modules/finance/application/use-cases/list-payouts.use-case.ts: NOVO — keyset pagination (requestedAt DESC, id DESC)
apps/api/src/modules/finance/application/use-cases/list-payouts.use-case.spec.ts: NOVO — 5 testes
apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts: NOVO — polling 15min, FOR UPDATE SKIP LOCKED, mismatch → outbox
apps/api/src/modules/finance/presentation/controllers/finance.controller.ts: EXPANDIDO — GET /summary, GET /transactions, GET /payouts
apps/api/src/modules/finance/finance.module.ts: EXPANDIDO — registra novos use cases e ReconciliationWorker

Frontend (apps/backoffice-web/):
apps/backoffice-web/src/features/finance/api/finance.api.ts: NOVO — funções de fetch para os 3 endpoints
apps/backoffice-web/src/features/finance/types/index.ts: NOVO — tipos TypeScript para finance
apps/backoffice-web/src/features/finance/lib/currency.ts: NOVO — formatCurrency (minor units → Intl.NumberFormat pt-BR)
apps/backoffice-web/src/features/finance/hooks/useBalance.ts: NOVO — polling 30s
apps/backoffice-web/src/features/finance/hooks/useFinanceSummary.ts: NOVO
apps/backoffice-web/src/features/finance/hooks/useTransactions.ts: NOVO — paginação por cursor
apps/backoffice-web/src/features/finance/hooks/usePayouts.ts: NOVO — paginação por cursor
apps/backoffice-web/src/features/finance/hooks/useCreatePayout.ts: NOVO
apps/backoffice-web/src/features/finance/components/BalanceSummaryCards.tsx: NOVO — cards com polling 30s
apps/backoffice-web/src/features/finance/components/FinancialSummaryPanel.tsx: NOVO — seletor 7/30/90 dias
apps/backoffice-web/src/features/finance/components/TransactionHistoryTable.tsx: NOVO — paginada por cursor
apps/backoffice-web/src/features/finance/components/PayoutHistoryTable.tsx: NOVO — badges de status
apps/backoffice-web/src/features/finance/components/PayoutRequestModal.tsx: NOVO — idempotencyKey via crypto.randomUUID()
apps/backoffice-web/src/features/finance/index.ts: NOVO — exports públicos
apps/backoffice-web/src/app/organizations/[organizationId]/finance/page.tsx: NOVO — rota /finance

Fix (incluído no mesmo branch):
apps/api/src/modules/payments/payments.module.ts: removida exportação inválida de FINANCIAL_RECORD_PORT (token provido por FinanceModule, não por PaymentsModule)

Implementado
GET /finance/summary agrega ledger_entries por account code e entry_type via SQL GROUP BY — backend é fonte única de verdade.
Keyset pagination sem OFFSET em transações e payouts — cursores base64(date|id) estáveis.
ReconciliationWorker detecta payouts PROCESSING há mais de 30min, aplica transição idempotente, emite finance.reconciliation-mismatch.v1 no outbox se amount/currency diverge — nunca altera entries existentes.
Dashboard backoffice /finance com BalanceSummaryCards (polling 30s), FinancialSummaryPanel (7/30/90 dias), TransactionHistoryTable, PayoutHistoryTable, PayoutRequestModal.
Formatação de moeda: minor units → Intl.NumberFormat pt-BR no frontend.
Bigint → string na serialização JSON (serialização manual no controller).

Decisões tomadas
Cursor keyset: base64(occurredAt.toISOString() + '|' + id) — estável e opaco para o cliente.
ReconciliationWorker nunca altera ledger_entries — divergência vai para outbox; reconciliação administrativa fica para TASK futura.
Frontend não recalcula finanças — exibe exatamente o que o backend retorna.
conditional spread nos hooks para satisfazer exactOptionalPropertyTypes do tsconfig do backoffice.
reference formatada como source_type:source_id (ex: SALE:order-uuid) para legibilidade no histórico.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api typecheck	aprovado (0 erros)
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes (fora do escopo)
pnpm --filter @ticket-seller/api test	348 testes passando (incluindo 15 novos de TASK-052)
pnpm --filter @ticket-seller/backoffice-web lint	aprovado
pnpm --filter @ticket-seller/backoffice-web typecheck	aprovado (0 erros)

Riscos identificados
Nenhum novo. Testes de integração requerem Postgres real para execução.

Pendências
Nenhuma de código. Exportação CSV/Excel/PDF e ajuste manual de ledger são fora do escopo do MVP.

Documentação atualizada
docs/CURRENT_STATE.md (atualizado neste relatório).
.ai/coordination/INTEGRATION_QUEUE.md (atualizado neste relatório).

Próxima tarefa recomendada
TASK-053 — Autenticação (maior gap do MVP identificado).
