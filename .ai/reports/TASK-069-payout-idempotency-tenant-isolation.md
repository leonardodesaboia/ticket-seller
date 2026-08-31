# Relatório da TASK-069 — Isolamento tenant da idempotência de payout

## Status

COMPLETED

## Arquivos alterados

- `apps/api/prisma/schema.prisma`: unicidade de payout alterada para organização + chave.
- `apps/api/prisma/migrations/20260831000000_scope_payout_idempotency_by_organization/migration.sql`: migration nova, sem alterar migrations aplicadas.
- `apps/api/src/modules/finance/domain/ports/payout.repository.port.ts`: lookup recebe `organizationId`.
- `apps/api/src/modules/finance/infrastructure/repositories/prisma-payout.repository.ts`: conflito e busca filtram por organização.
- `apps/api/src/modules/finance/application/use-cases/create-payout.use-case.ts`: retry de dispatch sem `externalPayoutId`; chave estável baseada no UUID do payout.
- `apps/api/src/modules/finance/application/use-cases/create-payout.use-case.spec.ts`: cobertura de retry do provider.
- `apps/api/test/integration/finance/payout.integration-spec.ts`: isolamento entre organizações e rejeição de acesso cruzado.

## Implementado

- A mesma chave em organizações diferentes pode criar payouts distintos.
- Replay na mesma organização continua sem duplicar reserva ou lançamento de ledger.
- Um payout `SCHEDULED` sem `externalPayoutId` pode retomar o dispatch com a mesma chave externa estável.
- O teste não expõe `externalPayoutId` na resposta HTTP.

## Decisões tomadas

- A constraint de banco é a proteção primária contra colisão concorrente.
- O UUID persistido do payout é usado como idempotency key do provider, evitando limite/formato dependente da chave do cliente.
- Não foi alterado o contrato público da API.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api exec jest --config jest.config.ts src/modules/finance/application/use-cases/create-payout.use-case.spec.ts --runInBand` | Aprovado — 9 testes |
| `pnpm --filter @ticket-seller/api typecheck` | Aprovado |
| `pnpm --filter @ticket-seller/api exec prisma validate` | Aprovado |
| `bash .ai/scripts/validate-migrations.sh` | Aprovado; migration nova listada como `A` |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | Aprovado |
| `git diff --check` | Aprovado |
| `payout.integration-spec.ts` | Não executado: runtime Docker/Testcontainers indisponível |

## Riscos identificados

- A integração PostgreSQL ainda precisa confirmar a migration e o isolamento em banco real (Docker/Testcontainers indisponível no ambiente de desenvolvimento).

## Pendências

- Executar integração com PostgreSQL/Testcontainers em ambiente com Docker para validar constraint `(organization_id, idempotency_key)` em banco real.

## Documentação atualizada

- `.ai/tasks/TASK-069-payout-idempotency-tenant-isolation.md`
- `docs/CURRENT_STATE.md`

## Próxima tarefa recomendada

Executar a suíte de integração em ambiente com Docker e, em seguida, concluir a validação financeira do webhook de payout.
