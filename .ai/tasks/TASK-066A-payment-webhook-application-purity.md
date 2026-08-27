# TASK-066A — Pureza de application em criação e webhook de pagamento

## Status

IN_PROGRESS

## Objetivo

Concluir a extração das operações persistentes de `create-payment-attempt` e `process-payment-webhook` para adapters específicos, preservando idempotência, locks, estoque, emissão, ledger e outbox.

## Arquivos permitidos

- `apps/api/src/modules/payments/**`
- `.ai/scripts/validate-architecture*`
- `.ai/reports/**`
- `.ai/coordination/**`

## Arquivos proibidos

- rotas, DTOs, OpenAPI, schema Prisma e migrations;
- workers/schedulers;
- módulos fora de payments, exceto contracts públicos já existentes.

## Invariantes

- webhook deduplicado por `(provider, provider_event_id)`;
- `FOR UPDATE`, ticket issuance, ledger e outbox permanecem na mesma transação;
- todos os dados pertencem à organização do `payment_attempt` interno;
- nenhum port expõe Prisma ou client de transação.

## Validação

- testes unitários dos fluxos;
- validator arquitetural;
- typecheck;
- diff check.
