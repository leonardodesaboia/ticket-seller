# TASK-070 — Modelo financeiro único para taxas do comprador e produtor

## Status

IN_REVIEW

## Objetivo

Definir e implementar um modelo de preço que separe explicitamente o subtotal dos ingressos, a taxa cobrada do comprador, as taxas do produtor, o total pago e o líquido do produtor.

## Resultado observável

Pedidos, snapshots, ledger, refunds, settlement e payouts usam bases de cálculo consistentes e reconstruíveis, sem contabilizar a taxa do comprador como receita do produtor.

## Contexto obrigatório

- `AGENTS.md`
- `docs/DOMAIN.md`
- `docs/ARCHITECTURE.md`
- `docs/decisions/ADR-005-payment-confirmation-and-ticket-issuance.md`
- `docs/modules/finance.md`
- `docs/modules/orders.md`
- `.ai/reports/DEEP-TECHNICAL-AUDIT-2026-08-31.md`

## Arquivos permitidos

- task e relatório desta tarefa;
- contratos, entidades, casos de uso, adapters, migrations e testes diretamente relacionados ao modelo de preço;
- documentação/ADR necessária para registrar a decisão.

## Arquivos proibidos

- integração de um PSP real;
- alteração de regras de autorização;
- alteração de workers sem task própria;
- ativação da taxa antes dos invariantes financeiros estarem cobertos.

## Invariantes

- valores monetários permanecem em minor units e `bigint`;
- ledger é append-only e cada operação é auditável;
- subtotal, taxa do comprador, taxas do produtor e líquido são persistidos sem ambiguidade;
- refund e settlement usam o snapshot original, nunca uma recomputação divergente;
- uma organização não acessa dados financeiros de outra.

## Segurança, concorrência e idempotência

- confirmação, refund e settlement permanecem idempotentes;
- cálculos e snapshots são feitos na mesma transação da operação financeira correspondente;
- testes PostgreSQL cobrem concorrência e isolamento multi-tenant.

## Fora do escopo

- escolha comercial dos percentuais;
- novo provedor de pagamento;
- redesign visual do checkout;
- alteração do countdown de reserva.

## Critérios de aceite

- decisão de base de cálculo registrada em ADR ou documentação oficial;
- `PLATFORM_FEE_BPS` só pode ser ativada após snapshot/ledger/refund/settlement consistentes;
- testes unitários e PostgreSQL reais cobrem taxa zero, taxa do comprador, taxa do produtor e ambas;
- typecheck, lint, testes, migration validation e arquitetura passam.

## Próxima tarefa

Definir a política financeira e criar a migration do snapshot de preço.
