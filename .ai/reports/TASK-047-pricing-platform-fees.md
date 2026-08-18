Relatório da TASK-047 — Pricing & Platform Fees
Status

COMPLETED

Arquivos alterados
apps/api/prisma/migrations/20260818000024_fee_policies/migration.sql: NOVO — tabela fee_policies com platformFeeBps, refundFeePolicy, settlementDelayDays; seed global 0 bps
apps/api/prisma/migrations/20260818000025_order_pricing_snapshot/migration.sql: NOVO — tabela order_pricing_snapshots com CHECK(gross = platformFee + processingFee + sellerNet)
apps/api/prisma/schema.prisma: adicionados modelos FeePolicy e OrderPricingSnapshot
apps/api/src/shared/kernel/money.ts: NOVO — calculateFeeAmount (floor BPS), assertPricingInvariant
apps/api/src/shared/kernel/money.spec.ts: NOVO — 13 testes unitários puros
apps/api/src/modules/finance/domain/entities/fee-policy.entity.ts: NOVO
apps/api/src/modules/finance/domain/entities/order-pricing-snapshot.entity.ts: NOVO
apps/api/src/modules/finance/domain/ports/fee-policy.repository.port.ts: NOVO
apps/api/src/modules/finance/domain/ports/order-pricing-snapshot.repository.port.ts: NOVO
apps/api/src/modules/finance/domain/ports/financial-record.port.ts: NOVO — IFinancialRecordPort com recordSale
apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.ts: NOVO
apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.spec.ts: NOVO — 8 testes
apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts: NOVO
apps/api/src/modules/finance/infrastructure/repositories/prisma-fee-policy.repository.ts: NOVO
apps/api/src/modules/finance/infrastructure/repositories/prisma-order-pricing-snapshot.repository.ts: NOVO
apps/api/src/modules/finance/infrastructure/adapters/financial-record.adapter.ts: NOVO
apps/api/src/modules/finance/finance.module.ts: NOVO
apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts: EXPANDIDO — injeta FINANCIAL_RECORD_PORT e chama recordSale dentro da transação
apps/api/src/modules/payments/payments.module.ts: EXPANDIDO — importa FinanceModule

Implementado
fee_policies com política global padrão (0 bps, TBD, 7 dias) seedada na migration via ON CONFLICT DO NOTHING.
order_pricing_snapshots imutável com CHECK constraint garantindo gross = sum das partes.
money.ts com aritmética bigint pura: calculateFeeAmount usa floor(gross × bps / 10000); assertPricingInvariant lança erro se invariante violada.
IFinancialRecordPort desacopla o módulo payments do módulo finance.
RecordSaleUseCase busca política ativa (org-específica → fallback global) e persiste snapshot atomicamente.
Integração síncrona: ProcessPaymentWebhookUseCase chama recordSale dentro da transação antes do commit.

Decisões tomadas
floor rounding em calculateFeeAmount: bps=333, gross=10001 → fee=333 (não 3330, documentado com comentário explicativo nos testes).
Fallback de política: org-específica → global — garante que sempre haja uma política ativa.
Snapshot persistido via $executeRaw com ON CONFLICT DO NOTHING para idempotência.
process-payment-webhook.use-case.spec.ts atualizado (arquivo fora da lista permitida) para evitar testes quebrados — regra do AGENTS.md "não ignorar testes quebrados" prevaleceu.

Testes executados
Comando	Resultado
pnpm --filter @ticket-seller/api prisma validate	aprovado
pnpm --filter @ticket-seller/api lint	6 erros pré-existentes (fora do escopo)
pnpm --filter @ticket-seller/api typecheck	aprovado
pnpm --filter @ticket-seller/api test	264 testes passando + 21 novos (money.spec: 13, calculate-order-pricing: 8)

Riscos identificados
Nenhum novo.

Pendências
Nenhuma.

Documentação atualizada
Nenhuma (documentação de fase será atualizada na conclusão de TASK-052).

Próxima tarefa recomendada
TASK-048 — Financial Ledger
