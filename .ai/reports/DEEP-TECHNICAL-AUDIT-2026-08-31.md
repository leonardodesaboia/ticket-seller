# Auditoria técnica aprofundada — 2026-08-31

## Escopo e método

Auditoria estática dos módulos críticos da API, mudanças locais, arquitetura, CI, scripts e rastreabilidade. Evidências foram verificadas no worktree atual; nenhuma conclusão de relatório anterior foi aceita sem confirmação no código.

## Decisão operacional

Não integrar as alterações locais de `PLATFORM_FEE_BPS` nem concluir a TASK-068 neste estado. A taxa do comprador ainda não possui um modelo financeiro que preserve o ledger, saldo do produtor, payout e refund. A TASK-068 continua em progresso até cumprir seus testes de concorrência e critérios de aceite.

Foi corrigida separadamente a precisão de `calculateFeeAmount`: o cálculo agora usa somente `bigint` e possui regressão acima de `Number.MAX_SAFE_INTEGER`.

## Achados bloqueantes

| Achado | Evidência | Impacto | Ação necessária |
| --- | --- | --- | --- |
| Taxa do comprador contabilizada como receita do produtor | `orders/infrastructure/adapters/reservation-access.adapter.ts`, `payments/infrastructure/adapters/prisma-payment-webhook-operation.adapter.ts`, `finance/application/use-cases/calculate-order-pricing.use-case.ts` | Com `PLATFORM_FEE_BPS > 0`, `total_amount` é usado como `grossAmount`; a taxa do comprador pode ir para o produtor e a fee policy do vendedor incide sobre uma base inflada. Ledger, saldo, payout e refund ficam incorretos. | Criar modelo de preço com snapshot imutável que separe subtotal, taxa do comprador, taxas do vendedor, total pago e líquido do produtor; testar com PostgreSQL real. |
| Idempotência de payout sem escopo de tenant | `prisma/migrations/20260818000029_payouts/migration.sql`, `finance/infrastructure/repositories/prisma-payout.repository.ts`, `finance/application/use-cases/create-payout.use-case.ts` | A chave global pode devolver a um pedido de uma organização o payout de outra. | Nova migration para unicidade por `(organization_id, idempotency_key)`, consultas com `organizationId` e teste de isolamento. |
| Reversão do ledger para `refund_fee_policy=REFUND` não zera a venda | `finance/application/use-cases/record-refund.use-case.ts` | Contas de clearing e receita não são revertidas simetricamente. | Definir entradas de reversão e adicionar teste contábil de soma zero por conta. |

## Achados altos e médios

| Severidade | Achado | Evidência | Próximo passo |
| --- | --- | --- | --- |
| Alto | `scan-secrets.sh` não detecta atribuições sem espaços, como `JWT_SECRET=value`. | `.ai/scripts/scan-secrets.sh` | Cobrir formatos reais de env/YAML e substituir ou ampliar o scanner. |
| Alto | CI permite audit com findings críticos/altos; RC ainda declara pronto. | `.github/workflows/ci.yml`, `docs/release/RC-1.0.md` | Allowlist temporal e bloqueio de findings novos ou não aprovados. |
| Alto | Deploy manual aceita imagem arbitrária e confirma apenas liveness. | `.github/workflows/cd.yml` | Exigir artefato certificado e verificar readiness pós-deploy. |
| Médio | Locks `SKIP LOCKED` dos workers terminam antes do processamento; não há exclusão durante a operação. | workers de `finance` | Usar claim persistente ou documentar idempotência como mecanismo oficial; testar duas instâncias. |
| Médio | Falha em `boss.schedule()` é absorvida mesmo no primeiro bootstrap. | workers de `finance` | Expor degradação em readiness ou falhar/retry controlado. |
| Médio | Cobertura mínima de 80% não é medida na CI. | `jest.config.ts`, CI | Configurar coleta, thresholds e execução na CI. |
| Médio | `validate-changed-files.sh` não lista arquivos não rastreados. | `.ai/scripts/validate-changed-files.sh` | Aplicar a mesma união de diff e untracked usada nos demais scripts. |

## Evidências positivas

- A validação arquitetural passou, incluindo 15 testes dos guardrails.
- Não foram encontradas novas dependências proibidas em `domain` ou `application`, controllers com Prisma, nem imports internos entre módulos fora dos contracts permitidos.
- Webhooks verificam assinatura/corpo bruto, valor e moeda; usam deduplicação e lock de pedido.
- Typecheck da API e a suíte unitária atual passaram após a correção monetária.

## Ordem recomendada

1. Manter `PLATFORM_FEE_BPS` bloqueada e abrir tarefa de modelo financeiro de preço/snapshot.
2. Corrigir a idempotência de payout por tenant, com migration e teste de isolamento.
3. Corrigir a reversão contábil de refund.
4. Concluir TASK-068 com testes de scheduler/concorrência e sem alegações de lock não garantidas.
5. Endurecer secrets, audit, cobertura e deploy.
