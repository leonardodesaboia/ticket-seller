Relatório da TASK-048 — Financial Ledger
Status

COMPLETED

Arquivos alterados
apps/api/prisma/migrations/20260818000026_financial_ledger/migration.sql: NOVO — tabelas ledger_accounts, ledger_transactions, ledger_entries; seed PLATFORM_CLEARING e PLATFORM_REVENUE
apps/api/prisma/schema.prisma: adicionados modelos LedgerAccount, LedgerTransaction, LedgerEntry
apps/api/src/modules/finance/domain/entities/ledger-account.entity.ts: NOVO
apps/api/src/modules/finance/domain/entities/ledger-transaction.entity.ts: NOVO
apps/api/src/modules/finance/domain/entities/ledger-entry.entity.ts: NOVO
apps/api/src/modules/finance/domain/ports/ledger.repository.port.ts: NOVO — ILedgerRepository append-only
apps/api/src/modules/finance/domain/ports/financial-record.port.ts: EXPANDIDO — adicionados recordRefund e recordChargeback
apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts: EXPANDIDO — cria ledger entries ORDER_PAID na mesma transação do snapshot
apps/api/src/modules/finance/application/use-cases/record-refund.use-case.ts: NOVO — respeita refund_fee_policy (RETAIN/REFUND/PROPORTIONAL/TBD→RETAIN)
apps/api/src/modules/finance/application/use-cases/record-chargeback.use-case.ts: NOVO — DEBIT SELLER_PAYABLE, CREDIT PLATFORM_CLEARING
apps/api/src/modules/finance/infrastructure/repositories/prisma-ledger.repository.ts: NOVO — append-only, balanceamento antes do INSERT, findOrCreate atômico
apps/api/src/modules/finance/infrastructure/adapters/financial-record.adapter.ts: EXPANDIDO — delega recordRefund e recordChargeback
apps/api/src/modules/finance/finance.module.ts: EXPANDIDO — registra PrismaLedgerRepository, RecordRefundUseCase, RecordChargebackUseCase
apps/api/src/modules/payments/application/use-cases/process-refund.use-case.ts: EXPANDIDO — chama recordRefund dentro da transação
apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.ts: EXPANDIDO — chama recordChargeback dentro da transação
apps/api/src/modules/payments/application/use-cases/process-refund.use-case.spec.ts: atualizado mocks do construtor expandido
apps/api/src/modules/payments/application/use-cases/process-chargeback.use-case.spec.ts: atualizado mocks do construtor expandido
apps/api/test/integration/finance/ledger.integration-spec.ts: NOVO — 4 cenários (Testcontainers)

Implementado
Ledger double-entry append-only: ledger_entries e ledger_transactions nunca sofrem UPDATE/DELETE.
Invariante de balanceamento sum(DEBIT)=sum(CREDIT) verificada antes de qualquer INSERT de entries.
Idempotência via UNIQUE(source_type, source_id) em ledger_transactions + ON CONFLICT DO NOTHING.
Contas de plataforma seedadas na migration; contas por org criadas via findOrCreate atômico.
ORDER_PAID: DEBIT PLATFORM_CLEARING (gross), CREDIT SELLER_PAYABLE[org] (sellerNet), CREDIT PLATFORM_REVENUE (platformFee — omitido se 0).
REFUND RETAIN: DEBIT SELLER_PAYABLE[org] = sellerNet, CREDIT PLATFORM_CLEARING = sellerNet.
REFUND REFUND: DEBIT SELLER_PAYABLE = gross, CREDIT PLATFORM_CLEARING = sellerNet, CREDIT PLATFORM_REVENUE = platformFee.
TBD → RETAIN como safe default operacional.
CHARGEBACK: DEBIT SELLER_PAYABLE[org] = chargebackAmount, CREDIT PLATFORM_CLEARING = chargebackAmount.

Decisões tomadas
Idempotência por contagem de entries: após ON CONFLICT DO NOTHING, verifica COUNT(*) de entries existentes; se > 0, retorna sem reinserir.
PROPORTIONAL usa aritmética inteira (amount * refundAmount / gross) sem float.
Entry com amount=0n nunca inserida — verificação antes de adicionar ao array de entries.
SELLER_PAYABLE code: SELLER_PAYABLE:<organizationId> — unicidade por org via code UNIQUE.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api typecheck	aprovado (0 erros)
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes (fora do escopo)
pnpm --filter @ticket-seller/api test	311 passando + falhas pré-existentes (health e2e)

Riscos identificados
Testes de integração (Testcontainers) não executados sem banco disponível.

Pendências
Nenhuma de código. Testes de integração requerem Postgres real.

Documentação atualizada
Nenhuma (documentação de fase será atualizada na conclusão de TASK-052).

Próxima tarefa recomendada
TASK-049 — Merchant Balance & Settlement
