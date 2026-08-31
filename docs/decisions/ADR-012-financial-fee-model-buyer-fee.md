# ADR-012 — Separação da taxa do comprador do modelo de taxas do produtor

## Status

ACCEPTED

## Data

2026-08-31

## Contexto

O modelo de preço atual calcula três valores a partir do `grossAmount` (subtotal dos ingressos):

| Campo | Definição |
|---|---|
| `platformFeeAmount` | taxa retida pela plataforma (bps sobre subtotal) |
| `processingFeeAmount` | taxa de processamento (bps sobre subtotal, opcional) |
| `sellerNetAmount` | `grossAmount − platformFee − processingFee` |

Invariante hoje:
```
grossAmount = sellerNetAmount + platformFeeAmount + processingFeeAmount
```

Esses três valores são persistidos em `order_pricing_snapshots` e usados como fonte verdadeira para refund e settlement. O ledger `ORDER_PAID` debita `PLATFORM_CLEARING` pelo `grossAmount`.

**Lacuna:** Se a plataforma cobrar uma taxa de conveniência diretamente do comprador (i.e., o comprador paga `grossAmount + buyerFeeAmount`), essa receita não tem campo no snapshot, não aparece em nenhuma conta do ledger e fica invisível ao refund. O `PLATFORM_CLEARING` seria debitado apenas pelo subtotal, enquanto a gateway de pagamento teria creditado o valor total — criando uma discrepância entre caixa real e contabilidade interna.

A auditoria técnica de 2026-08-31 (`.ai/reports/DEEP-TECHNICAL-AUDIT-2026-08-31.md`) classificou essa lacuna como debt financeiro de alta prioridade que impede a ativação de `BUYER_FEE_BPS` em produção.

## Decisão

Adicionar `buyerFeeBps` e `buyerFeeAmount` ao modelo de preço, separando explicitamente a taxa cobrada do comprador das taxas cobradas do produtor.

**Base de cálculo:**
- `buyerFeeAmount = floor(grossAmount × buyerFeeBps / 10_000)` — base é o subtotal do ingresso, não o total pago
- `sellerNetAmount` permanece `grossAmount − platformFeeAmount − processingFeeAmount` — a taxa do comprador não afeta o líquido do produtor

**Snapshots** (`order_pricing_snapshots`):
- Adicionar colunas `buyer_fee_bps` (integer, default 0) e `buyer_fee_amount` (bigint, default 0)
- Retrocompatível: pedidos anteriores ficam com `buyer_fee_amount = 0`

**Ledger `ORDER_PAID`** (após a mudança):
```
DEBIT  PLATFORM_CLEARING  = grossAmount + buyerFeeAmount   ← valor real recebido da gateway
CREDIT SELLER_PAYABLE      = sellerNetAmount               ← obrigação com o produtor
CREDIT PLATFORM_REVENUE    = platformFeeAmount
                           + processingFeeAmount
                           + buyerFeeAmount                ← toda a receita da plataforma
```
Balanço duplo-entrada preservado:
`grossAmount + buyerFee = sellerNet + platformFee + processingFee + buyerFee` ✓

**Refund:**
- Por padrão, taxa do comprador é não-reembolsável (política `RETAIN`)
- Políticas `REFUND` e `PROPORTIONAL` existentes continuam aplicadas apenas ao subtotal e às taxas do produtor
- Uma extensão futura pode adicionar `refundBuyerFee: boolean` à `FeePolicy` sem afetar a estrutura do snapshot

**Settlement e payout:**
- `settle-order.use-case.ts` recebe `sellerNetAmount` do snapshot — inalterado
- `create-payout.use-case.ts` opera sobre `sellerNetAmount` — inalterado

## Razões

- Corretude contábil: `PLATFORM_CLEARING` deve refletir o caixa real recebido da gateway, não apenas o subtotal
- Imutabilidade: snapshot salvo no momento da venda é a única fonte verdadeira para refund e settlement futuros — calcular novamente criaria divergência se a política mudar
- Separação de responsabilidade: taxa do comprador é receita da plataforma; nunca deve ser tratada como parte do subtotal do produtor ou deduzida do seu líquido
- Extensibilidade: `buyerFeeBps` por organização ou por evento é possível sem alterar o contrato de settlement
- Sem regressão: `buyerFeeBps = 0` e `buyerFeeAmount = 0` produzem exatamente o comportamento atual

## Consequências positivas

- Ledger reconciliável com o extrato bancário: debitar apenas o subtotal quando o comprador pagou subtotal + taxa é um erro de caixa
- Relatórios financeiros distinguem receita de serviço do comprador de receita de plataforma cobrada ao produtor
- Refund calcula o valor correto a devolver ao comprador sem precisar de lógica especial para a taxa de conveniência
- Auditoria de cada pedido: snapshot persiste os quatro valores sem ambiguidade (`grossAmount`, `buyerFeeAmount`, `sellerNetAmount`, taxas do produtor)

## Consequências negativas

- Migration aditiva em `order_pricing_snapshots` (duas colunas com default 0) — sem impacto em pedidos existentes, mas requer migration e rollout coordenado
- `FeePolicy` e `FeeCalculation` ganham dois campos novos — todas as call sites de `CalculateOrderPricingUseCase` precisam ser atualizadas
- Regras de refund para taxa do comprador devem ser definidas explicitamente na `FeePolicy` antes de ativar `buyerFeeBps > 0` em produção

## Alternativas consideradas

### Incluir buyerFee no grossAmount

Tratar o valor total pago (`grossAmount + buyerFee`) como `grossAmount` no snapshot.

Rejeitado: `sellerNetAmount` seria calculado sobre a base errada, inflando o líquido do produtor. Refund precisaria de lógica ad-hoc para separar o que pertence ao comprador. Snapshot perderia a distinção entre subtotal e taxa de conveniência.

### Não persistir buyerFee no snapshot — recalcular ao fazer refund

Recalcular `buyerFeeAmount` a partir da política vigente no momento do refund.

Rejeitado: viola o princípio de que o snapshot é imutável e fonte verdadeira. Se a política mudar após a venda (ex: taxa aumentada de 5% para 10%), o refund usaria a taxa errada, gerando erro de caixa ou cobrança indevida ao cliente.

### Campo único buyerFee no snapshot sem buyerFeeBps

Persistir apenas `buyer_fee_amount` sem o `buyer_fee_bps` aplicado.

Rejeitado: sem o `bps`, a auditoria não consegue verificar se o valor cobrado está correto em relação à política vigente no momento da compra.

## Impactos

### Código

- `apps/api/src/modules/finance/domain/entities/fee-policy.entity.ts` — adicionar `buyerFeeBps?: number`
- `apps/api/src/modules/finance/domain/value-objects/fee-calculation.vo.ts` — adicionar `buyerFeeBps: number`, `buyerFeeAmount: bigint`
- `apps/api/src/modules/finance/domain/entities/order-pricing-snapshot.entity.ts` — adicionar `buyerFeeBps: number`, `buyerFeeAmount: bigint`
- `apps/api/src/modules/finance/application/use-cases/calculate-order-pricing.use-case.ts` — calcular e retornar `buyerFeeAmount`
- `apps/api/src/modules/finance/application/use-cases/record-sale.use-case.ts` — persistir `buyerFeeAmount` no snapshot e ajustar entradas do ledger
- `apps/api/src/modules/finance/infrastructure/repositories/prisma-order-pricing-snapshot.repository.ts` — ler/escrever novos campos
- Specs dos use cases acima — cobertura de taxa zero, taxa do comprador, taxa do produtor, ambas

### Infraestrutura

Migration Prisma aditiva: adicionar `buyer_fee_bps INTEGER NOT NULL DEFAULT 0` e `buyer_fee_amount BIGINT NOT NULL DEFAULT 0` à tabela `order_pricing_snapshots`. Sem downtime: `DEFAULT` aplicado inline pelo PostgreSQL.

### Segurança

Nenhum impacto direto. `buyerFeeBps` vem da `FeePolicy` resolvida internamente — nunca de input do comprador.

### Custos

Neutro: duas colunas inteiras por pedido não afetam significativamente armazenamento ou performance de queries.

### Escalabilidade

Neutro: cálculo é aritmético puro (sem IO adicional). Snapshot continua sendo criado em uma única operação dentro da transação da venda.

### Migração ou reversão

- **Aplicar:** executar a migration aditiva + deploy da aplicação. Pedidos novos passam a registrar `buyerFeeAmount`; pedidos antigos permanecem com `0`.
- **Reverter:** remover o cálculo de `buyerFeeBps` do `CalculateOrderPricingUseCase` (retorna `0`) antes de reverter a migration — garante que nenhum dado seja perdido; a migration pode ser dropada somente após validar que nenhum pedido ativo tem `buyer_fee_amount > 0`.

## Referências

- TASK-070 — Implementação desta ADR
- `.ai/reports/DEEP-TECHNICAL-AUDIT-2026-08-31.md` — identificação do debt
- `docs/modules/finance.md` — modelo de ledger existente
- ADR-005 — Confirmação de pagamento e emissão de ingresso (contexto de `record-sale`)
