TASK-047 — Pricing & Platform Fees

Status: PLANNED

Objetivo

Criar a política de taxa da plataforma (fee_policies), o cálculo determinístico de decomposição financeira em minor units e o snapshot imutável de precificação por order (order_pricing_snapshots), garantindo que toda order PAID tenha um registro financeiro auditável e congelado.

Resultado observável

- Tabela `fee_policies` com política global ativa (0 bps por padrão).
- Tabela `order_pricing_snapshots` criada atomicamente com o order PAID.
- `gross_amount = platform_fee_amount + processing_fee_amount + seller_net_amount` verificado por CHECK constraint e por invariante na aplicação.
- Alterar a política futuramente não modifica snapshots existentes.
- Testes unitários cobrem cálculo, arredondamento (floor), valores extremos e invariante.
- `pnpm typecheck`, `pnpm lint` e `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-047-pricing-platform-fees.md
- docs/modules/finance.md
- docs/modules/payments.md
- docs/modules/orders.md
- apps/api/prisma/schema.prisma
- apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts
- apps/api/prisma/migrations/20260812000009_orders/migration.sql (para entender totalAmount)

Arquivos permitidos

O agente pode criar ou alterar somente:
- apps/api/prisma/migrations/20260818000024_fee_policies/migration.sql (NOVO)
- apps/api/prisma/migrations/20260818000025_order_pricing_snapshot/migration.sql (NOVO)
- apps/api/prisma/schema.prisma (adicionar FeePolicy e OrderPricingSnapshot)
- apps/api/src/modules/finance/ (módulo novo — criar estrutura completa)
  - domain/entities/fee-policy.entity.ts
  - domain/entities/order-pricing-snapshot.entity.ts
  - domain/value-objects/fee-calculation.vo.ts
  - domain/ports/fee-policy.repository.port.ts
  - domain/ports/order-pricing-snapshot.repository.port.ts
  - domain/ports/financial-record.port.ts
  - application/use-cases/calculate-order-pricing.use-case.ts
  - application/use-cases/record-sale.use-case.ts
  - infrastructure/repositories/prisma-fee-policy.repository.ts
  - infrastructure/repositories/prisma-order-pricing-snapshot.repository.ts
  - infrastructure/adapters/financial-record.adapter.ts
  - finance.module.ts
- apps/api/src/shared/kernel/money.ts (NOVO — funções puras de cálculo)
- apps/api/src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts
  (APENAS adicionar chamada ao IFinancialRecordPort — sem alterar lógica existente)
- apps/api/src/modules/payments/payments.module.ts
  (adicionar injeção do IFinancialRecordPort)
- apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.spec.ts (NOVO)
- apps/api/src/shared/kernel/money.spec.ts (NOVO)

Arquivos proibidos

O agente não pode alterar:
- Qualquer migration já aplicada (prefixos anteriores a 20260818)
- apps/api/src/modules/orders/ (fora do escopo)
- apps/api/src/modules/inventory/ (fora do escopo)
- apps/api/src/modules/notifications/ (fora do escopo)
- pnpm-lock.yaml (sem instalar dependências novas)
- turbo.json, pnpm-workspace.yaml

Requisitos funcionais

1. `FeePolicy` global com `platformFeeBps=0`, `processingFeeBps=null`, `refundFeePolicy='TBD'`, `settlementDelayDays=7`.
2. `calculateOrderPricing(grossAmount, currency, policy)` retorna `{ platformFeeAmount, processingFeeAmount, sellerNetAmount }`.
3. Fórmula obrigatória: `platformFeeAmount = Math.floor(gross * bps / 10000)`.
4. `sellerNetAmount = gross - platformFeeAmount - processingFeeAmount`.
5. Invariante verificada em código antes de persistir: `gross === platformFee + processingFee + sellerNet`.
6. `RecordSaleUseCase` cria `order_pricing_snapshot` dentro da mesma transação que confirma o order.
7. Chamado via `IFinancialRecordPort` a partir de `ProcessPaymentWebhookUseCase`.
8. Snapshot imutável: sem UPDATE após criação.

Requisitos técnicos

- Migrations novas e aditivas (20260818000024 e 20260818000025).
- `FeePolicy` gerenciada por Prisma model.
- `OrderPricingSnapshot` gerenciada por Prisma model.
- `money.ts` expõe funções puras: `calculateFeeAmount(gross, bps)`, `calculateSellerNet(gross, platformFee, processingFee)`, `assertPricingInvariant(...)`.
- Sem dependências novas de pacotes.
- TypeScript strict; sem `any` sem justificativa.
- Seed da política global ocorre dentro da migration 24 (INSERT idempotente via ON CONFLICT DO NOTHING).

Invariantes

- `gross_amount = platform_fee_amount + processing_fee_amount + seller_net_amount` (CHECK constraint e aplicação).
- `platform_fee_amount >= 0`.
- `processing_fee_amount >= 0`.
- `seller_net_amount >= 0`.
- `gross_amount > 0`.
- Um order pode ter no máximo um snapshot (UNIQUE/PK em order_id).
- Snapshot não pode ser modificado após criação.
- Alterar `fee_policies` não altera snapshots já criados (FK preserva referência histórica).

Segurança

- Valores financeiros somente em minor units (BIGINT).
- Nunca float ou double.
- `platformFeeBps` entre 0 e 10000 (CHECK constraint).
- Nenhum dado sensível em logs financeiros.
- `IFinancialRecordPort` não expõe estrutura interna do ledger ao módulo payments.

Multi-tenancy

- `fee_policies` com `organization_id NULL` = política global (MVP).
- `order_pricing_snapshots` sem `organization_id` próprio — derivado via `order_id → orders.organization_id`.
- Consultas de snapshot sempre filtram por `order_id` específico (sem risco de vazamento entre orgs).

Concorrência

- `RecordSaleUseCase` roda dentro da transação de `ProcessPaymentWebhookUseCase`.
- Duplicate webhook processado exatamente uma vez (garantido pelo `UNIQUE(source_type, source_id)` que será criado em TASK-048 via ledger — nesta task, a idempotência do snapshot é garantida pelo PK em `order_id`).
- `ON CONFLICT DO NOTHING` no INSERT do snapshot protege contra processamento duplo.

Idempotência

- INSERT em `order_pricing_snapshots` com `ON CONFLICT (order_id) DO NOTHING`.
- Mesmo webhook processado duas vezes não cria dois snapshots.

Fora do escopo

- Ledger financeiro (TASK-048).
- Saldo do produtor (TASK-049).
- Payout (TASK-050/051).
- Dashboard (TASK-052).
- Política de fee por organização (futura).
- Fee em refunds (módulo de refund não é alterado nesta task — apenas a estrutura de snapshot inclui `refund_fee_policy` do moment da venda).
- Partial refund processing (futura).

Plano esperado

Antes de implementar, o agente deve descrever:
- Estrutura de arquivos do módulo finance/
- Fluxo de chamada: ProcessPaymentWebhookUseCase → IFinancialRecordPort → RecordSaleUseCase → snapshot
- Schema das duas migrations
- Testes planejados

Critérios de aceite

- `fee_policies` criada com seed de política global (0 bps).
- `order_pricing_snapshots` criada com CHECK constraint de invariante.
- `calculateFeeAmount` e `assertPricingInvariant` em `money.ts` com testes unitários.
- `RecordSaleUseCase` integrado na transação do webhook.
- `pnpm lint` aprovado.
- `pnpm typecheck` aprovado.
- `pnpm test` aprovado (testes unitários de money.ts e calculate-order-pricing).
- Nenhum arquivo fora do escopo alterado.

Comandos

```bash
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
pnpm --filter @ticket-seller/api prisma validate
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-048 — Financial Ledger
