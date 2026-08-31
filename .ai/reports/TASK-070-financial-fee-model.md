# Relatório da TASK-070 — Modelo financeiro único para taxas do comprador e produtor

## Status

IN_REVIEW

## Arquivos alterados

- `docs/decisions/ADR-012-financial-fee-model-buyer-fee.md`: ADR criada documentando a decisão de separar a taxa do comprador do modelo de taxas do produtor.
- `apps/api/prisma/schema.prisma`: `FeePolicy` +`buyerFeeBps`; `OrderPricingSnapshot` +`buyerFeeBps`, +`buyerFeeAmount`.
- `apps/api/prisma/migrations/20260831000001_add_buyer_fee_to_pricing_snapshot/migration.sql`: migration aditiva com `DEFAULT 0` — sem impacto em dados existentes, sem downtime.
- `apps/api/src/modules/finance/domain/entities/fee-policy.entity.ts`: +`buyerFeeBps: number`.
- `apps/api/src/modules/finance/domain/entities/order-pricing-snapshot.entity.ts`: +`buyerFeeBps: number`, +`buyerFeeAmount: bigint`.
- `apps/api/src/modules/finance/domain/value-objects/fee-calculation.vo.ts`: +`buyerFeeBps: number`, +`buyerFeeAmount: bigint`.
- `apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.ts`: calcula `buyerFeeAmount = floor(grossAmount × buyerFeeBps / 10000)`.
- `apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts`: persiste `buyerFeeAmount` no snapshot; ajusta ledger: DEBIT PLATFORM_CLEARING = `gross + buyerFee`, CREDIT PLATFORM_REVENUE inclui `buyerFee`.
- `apps/api/src/modules/finance/infrastructure/repositories/prisma-order-pricing-snapshot.repository.ts`: INSERT e mapToEntity com novos campos.
- `apps/api/src/modules/finance/infrastructure/repositories/prisma-fee-policy.repository.ts`: mapToEntity com `buyerFeeBps`.
- `apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.spec.ts`: +`buyerFeeBps: 0` no makePolicy + 4 novos testes de taxa do comprador.
- `apps/api/src/modules/finance/application/use-cases/record-sale.use-case.spec.ts`: +`buyerFeeBps: 0` no makePolicy + 6 novos testes (snapshot, ledger debit, ledger credit, invariante dupla-entrada, seller balance).
- `apps/api/src/modules/finance/application/use-cases/record-refund.use-case.spec.ts`: +`buyerFeeBps: 0`, `buyerFeeAmount: 0n` no makeSnapshot.

## Implementado

- Taxa do comprador calculada sobre o subtotal dos ingressos, independente das taxas do produtor.
- `sellerNetAmount` inalterado: a taxa do comprador não afeta o líquido do produtor.
- Ledger `ORDER_PAID` com balanço dupla-entrada preservado:
  - DEBIT PLATFORM_CLEARING = `grossAmount + buyerFeeAmount`
  - CREDIT SELLER_PAYABLE = `sellerNetAmount`
  - CREDIT PLATFORM_REVENUE = `platformFee + processingFee + buyerFee`
- Retrocompatível: `buyerFeeBps = 0` produz comportamento idêntico ao modelo anterior.
- Migration aditiva — pedidos existentes recebem `buyer_fee_amount = 0`.

## Decisões tomadas

- Taxa do comprador tem base de cálculo sobre o `grossAmount` (subtotal), não sobre o total pago. Isso garante consistência independente de qual percentual de taxa do produtor está ativo.
- A ativação real (checkout cobrando `subtotal + buyerFee`) é pré-condição fora do escopo desta task — proibido pelo TASK-070 ("ativação da taxa antes dos invariantes financeiros estarem cobertos").
- `record-refund.use-case.ts` não alterado: taxa do comprador é não-reembolsável por padrão; extensão futura pode adicionar `refundBuyerFee` à `FeePolicy` sem quebrar o snapshot.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `jest calculate-order-pricing.use-case.spec.ts --runInBand` | Aprovado — 12 testes |
| `jest record-sale.use-case.spec.ts --runInBand` | Aprovado — 15 testes |
| `jest src/modules/finance --runInBand` | Aprovado — 120 testes |
| `pnpm --filter @ticket-seller/api typecheck` | Aprovado |
| `prisma validate` | Aprovado |
| `prisma generate` | Aprovado |
| `bash .ai/scripts/validate-migrations.sh` | Aprovado; nova migration listada como `A` |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | Aprovado |
| `git diff --check` | Aprovado |

## Riscos identificados

- Testes de integração PostgreSQL (concorrência + isolamento multi-tenant) não executados: Docker/Testcontainers indisponível no ambiente de desenvolvimento.

## Pendências

- Executar integração PostgreSQL em ambiente com Docker para validar a migration e o constraint em banco real.
- Ativação futura: `reservation-access.adapter.ts` deve setar `total_amount = subtotal + buyerFeeAmount` antes de `buyerFeeBps > 0` ser ativado em produção.

## Próxima tarefa recomendada

Revisão desta implementação e integração na branch principal.
