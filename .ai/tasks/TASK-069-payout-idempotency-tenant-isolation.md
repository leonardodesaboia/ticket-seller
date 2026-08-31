# TASK-069 — Isolamento tenant da idempotência de payout

## Status

COMPLETED

## Objetivo

Garantir que a chave de idempotência de payout seja única apenas dentro da organização proprietária, sem permitir que uma repetição em uma organização retorne ou afete um payout de outra.

## Arquivos permitidos

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/modules/finance/domain/ports/payout.repository.port.ts`
- `apps/api/src/modules/finance/infrastructure/repositories/prisma-payout.repository.ts`
- `apps/api/src/modules/finance/application/use-cases/create-payout.use-case.ts`
- `apps/api/src/modules/finance/application/use-cases/create-payout.use-case.spec.ts`
- `apps/api/test/integration/finance/payout.integration-spec.ts`
- `.ai/reports/TASK-069-payout-idempotency-tenant-isolation.md`

## Invariantes

- A mesma chave na mesma organização retorna o payout original sem novo ledger ou reserva de saldo.
- A mesma chave em organizações distintas cria payouts distintos e nunca expõe dados cruzados.
- A constraint do banco protege concorrência e isolamento, sem depender apenas da aplicação.
- Nenhum payout, saldo, ledger ou destinatário é consultado sem `organizationId` no fluxo de idempotência.

## Validação

- teste de integração PostgreSQL com duas organizações usando a mesma chave;
- testes unitários e integração de finance afetados;
- typecheck, lint aplicável, validação de migrations e `git diff --check`.
