TASK-048 — Financial Ledger

Status: PLANNED

Objetivo

Criar o ledger financeiro double-entry append-only da plataforma: tabelas `ledger_accounts`, `ledger_transactions` e `ledger_entries`, com os use cases de registro para os eventos ORDER_PAID, REFUND e CHARGEBACK, garantindo imutabilidade, idempotência e balanceamento de toda transação financeira.

Resultado observável

- Tabelas `ledger_accounts`, `ledger_transactions`, `ledger_entries` criadas.
- Contas da plataforma (`PLATFORM_CLEARING`, `PLATFORM_REVENUE`) inseridas pelo seed da migration.
- Toda `ledger_transaction` tem sum(DEBIT) = sum(CREDIT) — verificado antes de persistir.
- ORDER_PAID lança 3 entries (DEBIT PLATFORM_CLEARING, CREDIT SELLER_PAYABLE, CREDIT PLATFORM_REVENUE).
- REFUND lança entries conforme `refund_fee_policy` do snapshot (TBD → RETAIN como safe default operacional).
- CHARGEBACK lança entries debitando SELLER_PAYABLE.
- Mesmo evento processado duas vezes produz exatamente um conjunto de entries.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm test:integration` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-048-financial-ledger.md
- .ai/tasks/TASK-047-pricing-platform-fees.md (para entender snapshot e IFinancialRecordPort)
- docs/modules/finance.md
- apps/api/src/modules/finance/ (código criado em TASK-047)
- apps/api/prisma/schema.prisma (estado após TASK-047)
- apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts
- apps/api/src/modules/payments/application/use-cases/process-refund.use-case.ts
- apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts

Arquivos permitidos

O agente pode criar ou alterar somente:
- apps/api/prisma/migrations/20260818000026_financial_ledger/migration.sql (NOVO)
- apps/api/prisma/schema.prisma (adicionar LedgerAccount, LedgerTransaction, LedgerEntry)
- apps/api/src/modules/finance/domain/entities/ledger-account.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/entities/ledger-transaction.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/entities/ledger-entry.entity.ts (NOVO)
- apps/api/src/modules/finance/domain/ports/ledger.repository.port.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts (EXPANDIR — adicionar ledger)
- apps/api/src/modules/finance/application/use-cases/record-refund.use-case.ts (NOVO)
- apps/api/src/modules/finance/application/use-cases/record-chargeback.use-case.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/repositories/prisma-ledger.repository.ts (NOVO)
- apps/api/src/modules/finance/infrastructure/adapters/financial-record.adapter.ts (EXPANDIR)
- apps/api/src/modules/finance/finance.module.ts (EXPANDIR)
- apps/api/src/modules/payments/application/use-cases/process-refund.use-case.ts
  (APENAS adicionar chamada ao IFinancialRecordPort.recordRefund)
- apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts
  (APENAS adicionar chamada ao IFinancialRecordPort.recordChargeback)
- apps/api/test/integration/finance/ (NOVO — testes de integração do ledger)

Arquivos proibidos

- Migrations anteriores a 20260818 (nunca modificar)
- apps/api/src/modules/orders/ (fora do escopo)
- apps/api/src/modules/inventory/ (fora do escopo)
- apps/api/src/modules/notifications/ (fora do escopo)
- pnpm-lock.yaml

Requisitos funcionais

1. `LedgerAccount` com campos: id, code (UNIQUE), name, accountType, organizationId (NULL = plataforma), currency.
2. `LedgerTransaction` com idempotência via UNIQUE(source_type, source_id).
3. `LedgerEntry` com amount > 0, entry_type IN ('DEBIT','CREDIT').
4. Invariante de balanceamento verificada no repositório antes de INSERT.
5. Contas SELLER_PAYABLE:<orgId> e PAYOUT_CLEARING:<orgId> criadas sob demanda (findOrCreate atômico).
6. `RecordSaleUseCase` cria ledger entries na mesma transação do snapshot (ORDER_PAID).
7. `RecordRefundUseCase` respeita `refund_fee_policy` do snapshot: RETAIN devolve seller_net; REFUND devolve gross; TBD usa RETAIN como safe default.
8. `RecordChargebackUseCase` debita SELLER_PAYABLE[orgId] no gross amount.
9. `IFinancialRecordPort` é expandido com `recordRefund(input)` e `recordChargeback(input)`.
10. Nenhum UPDATE ou DELETE permitido em ledger_entries ou ledger_transactions.

Requisitos técnicos

- Migration 20260818000026 aditiva.
- Sem UPDATE/DELETE no LedgerRepository público.
- Correções futuras via novos lançamentos (ADJUSTMENT).
- Contas da plataforma inseridas no seed da migration (ON CONFLICT DO NOTHING).
- SQL nativo para operações de INSERT+verificação de balanceamento dentro de $transaction.
- Testes de integração com Testcontainers.

Invariantes

- sum(DEBIT) = sum(CREDIT) por ledger_transaction.
- amount > 0 em todo ledger_entry.
- UNIQUE(source_type, source_id) em ledger_transactions — mesmo evento não gera dois grupos de entries.
- ledger_entries não podem ser modificados após INSERT.
- Currency consistente dentro de uma transaction (todos os entries com a mesma currency).

Segurança

- Valores financeiros somente em minor units (BIGINT).
- Nunca `any` em tipos de amount.
- Nenhum dado bancário ou PII em logs de ledger.
- Acesso ao ledger somente via repositório — sem UPDATE/DELETE expostos.

Multi-tenancy

- SELLER_PAYABLE:<orgId> e PAYOUT_CLEARING:<orgId> são criadas com `organization_id` da org.
- PLATFORM_CLEARING e PLATFORM_REVENUE têm `organization_id = NULL`.
- `GetLedgerEntries` sempre filtra por `account_id` (derivado de `organization_id`).

Concorrência

- `findOrCreate` para contas de org usa INSERT ON CONFLICT DO NOTHING + SELECT — atômico.
- Dois webhooks do mesmo ORDER_PAID → UNIQUE(source_type, source_id) impede segundo INSERT em ledger_transactions.
- `$transaction` do Prisma garante atomicidade de entries.

Idempotência

- UNIQUE(source_type, source_id) em ledger_transactions.
- ON CONFLICT DO NOTHING no insert de ledger_transaction (retorna existente sem criar duplicata).

Fora do escopo

- Saldo do produtor (TASK-049).
- Settlement (TASK-049).
- Payout entries (TASK-051).
- Reconciliação (TASK-052).
- Ajustes administrativos (futuro).
- API de consulta do ledger (TASK-052).

Critérios de aceite

- Migration cria as 3 tabelas com constraints corretas.
- Seed insere PLATFORM_CLEARING e PLATFORM_REVENUE.
- RecordSaleUseCase integra snapshot + ledger em uma transação.
- RecordRefundUseCase respeita refund_fee_policy.
- RecordChargebackUseCase cria entries corretos.
- Testes de integração: ORDER_PAID, duplicate event, REFUND (RETAIN), CHARGEBACK passam.
- pnpm lint, typecheck, test aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api test:integration --testPathPattern=finance
pnpm --filter @ticket-seller/api prisma validate
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-049 — Merchant Balance & Settlement
