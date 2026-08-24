TASK-052 — Financial Dashboard & Reconciliation

Status: CONCLUÍDA

Objetivo

Criar as APIs de resumo financeiro e histórico de transações, o dashboard financeiro no backoffice, o histórico de payouts e um worker mínimo de reconciliação que detecta divergências sem corrigir o ledger silenciosamente.

Resultado observável

- `GET /organizations/:orgId/finance/summary` retorna gross_sales, platform_fees, refunds, net_sales, pending_balance, available_balance, paid_out por período.
- `GET /organizations/:orgId/finance/transactions` retorna histórico paginado do ledger (keyset).
- `GET /organizations/:orgId/payouts` retorna histórico de payouts paginado.
- Página `/organizations/[orgId]/finance` no backoffice exibe cards de saldo + tabelas.
- `ReconciliationWorker` detecta e registra divergências sem alterar ledger.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-052-financial-dashboard-reconciliation.md
- docs/modules/finance.md
- docs/modules/payouts.md
- apps/api/src/modules/finance/ (código completo de TASK-047 a TASK-051)
- apps/backoffice-web/src/features/ (referência de padrão de feature existente)
- apps/api/prisma/schema.prisma (estado final após TASK-051)

Arquivos permitidos

Backend:
- apps/api/src/modules/finance/application/use-cases/get-financial-summary.use-case.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/list-ledger-transactions.use-case.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/list-payouts.use-case.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/workers/reconciliation.worker.ts (NOVO)
- apps/api/src/modules/finance/presentation/controllers/finance.controller.ts (EXPANDIR)
- apps/api/src/modules/finance/finance.module.ts (EXPANDIR)
- apps/api/test/integration/finance/financial-summary.integration-spec.ts (NOVO)

Frontend (backoffice):
- apps/backoffice-web/src/features/finance/ (NOVA feature)
  - api/finance.api.ts
  - components/BalanceSummaryCards.tsx
  - components/FinancialSummaryPanel.tsx
  - components/TransactionHistoryTable.tsx
  - components/PayoutHistoryTable.tsx
  - components/PayoutRequestModal.tsx
  - hooks/useFinanceSummary.ts
  - hooks/useTransactions.ts
  - hooks/usePayouts.ts
  - index.ts
- apps/backoffice-web/src/app/organizations/[organizationId]/finance/page.tsx (NOVA rota)

Arquivos proibidos

- Migrations (nenhuma nova migration — sem schema changes nesta task)
- apps/api/src/modules/payments/ (sem alterações)
- apps/api/src/modules/orders/ (sem alterações)
- pnpm-lock.yaml

Requisitos funcionais

1. `GET /organizations/:orgId/finance/summary?from=&to=`:
   - Agrega ledger_entries por account e entry_type no período.
   - Retorna: grossSales, platformFees, processingFees, refunds, netSales, pendingBalance, availableBalance, reservedBalance, totalPaidOut.
   - Currency explícita na resposta.
2. `GET /organizations/:orgId/finance/transactions?cursor=&limit=`:
   - Keyset por occurred_at DESC + id DESC.
   - Campos: id, type, amount, currency, description, reference (source_type:source_id), occurredAt.
3. `GET /organizations/:orgId/payouts?cursor=&limit=`:
   - Keyset por requested_at DESC + id DESC.
   - Campos: id, amount, currency, status, externalPayoutId, requestedAt, succeededAt, failedAt.
4. `ReconciliationWorker` (polling 15min):
   - Busca payouts com status PROCESSING há mais de 30min.
   - Chama gateway.getPayoutStatus(externalPayoutId).
   - Se SUCCEEDED/FAILED → aplica transição idempotente.
   - Se amount/currency diverge → emite outbox `finance.reconciliation-mismatch.v1`, NÃO ajusta ledger.
5. Dashboard backoffice `/finance`:
   - BalanceSummaryCards: pending, available, reserved (polling 30s).
   - FinancialSummaryPanel: período selecionável (últimos 7/30/90 dias).
   - TransactionHistoryTable: paginada, com tipo e valor formatado.
   - PayoutHistoryTable: com status badges.
   - PayoutRequestModal: formulário de solicitação de payout (amount + idempotency_key gerado no frontend).

Requisitos técnicos

- Backend é fonte oficial — nunca recalcular contabilidade no frontend.
- SQL nativo para agregações de ledger (GROUP BY account, entry_type).
- Keyset pagination — sem OFFSET.
- Formatação de moeda no frontend: minor units → display (ex: 10000 → "R$ 100,00").
- Testes de integração para summary e transactions.

Invariantes

- Summary calculado a partir do ledger (não de seller_balances diretamente).
- Reconciliation nunca altera amount/currency de entry existente.
- Divergência registrada em outbox, não ignorada silenciosamente.
- Paginação sem OFFSET — keyset estável.

Segurança

- Todos endpoints financeiros exigem ActorGuard (OWNER, ADMIN, FINANCE).
- Cross-tenant: filtro obrigatório por organizationId.
- Outbox finance.reconciliation-mismatch.v1 não expõe dados bancários.
- PayoutRequestModal: amount validado no backend, não confiado do frontend.

Multi-tenancy

- Todos endpoints filtram por organizationId do path.
- Dashboard exibe apenas dados da organização autenticada.

Concorrência

- ReconciliationWorker: FOR UPDATE SKIP LOCKED em payouts PROCESSING.
- Dois workers não processam o mesmo payout (SKIP LOCKED).

Idempotência

- Transição de status de payout na reconciliação: idempotente (mesmo status já aplicado → no-op).

Fora do escopo

- Exportação CSV/Excel/PDF.
- Ajuste manual de ledger (futura — via FinancialAdjustment).
- Histórico de settlements (apenas endpoints de balance e transactions).
- Notificação por email de reconciliation mismatch (evento no outbox — worker de notificação cuida).
- Antifraude financeiro avançado.

Critérios de aceite

- GET /finance/summary retorna dados corretos para o período.
- GET /finance/transactions retorna histórico paginado via keyset.
- GET /payouts retorna histórico de payouts.
- Dashboard /finance exibe saldo e transações.
- ReconciliationWorker detecta PROCESSING antigo e aplica transição.
- Divergência → outbox finance.reconciliation-mismatch.v1 (sem alteração de ledger).
- pnpm lint, typecheck, test, test:integration aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=financial
pnpm --filter @ticket-seller/backoffice-web lint
pnpm --filter @ticket-seller/backoffice-web typecheck
pnpm build
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: Nenhuma — fase financeira concluída.
