# Relatório da TASK-065

## Status

COMPLETED — integrada localmente em 2026-08-26.

## Arquivos alterados

- `apps/api/src/platform/config/env.ts`: adiciona `PAYMENT_PROVIDER` e valida `FAKE_GATEWAY_SECRET` quando `fake` é usado em produção.
- `apps/api/src/platform/config/env.spec.ts`: cobre defaults e matriz de configuração de produção.
- `apps/api/src/modules/payments/infrastructure/payments.infrastructure.module.ts`: centraliza a seleção do gateway no módulo de infraestrutura.
- `apps/api/src/modules/payments/infrastructure/payments.infrastructure.module.spec.ts`: valida a resolução de `PAYMENT_GATEWAY_PORT` para `FakePaymentGateway`.
- `apps/api/src/modules/payments/payments.module.ts`: reexporta o módulo de infraestrutura, evitando reexport inválido de tokens Nest.
- `apps/api/src/modules/payments/infrastructure/adapters/fake/fake-payment.gateway.spec.ts`: restaura o ambiente entre testes.
- `apps/api/.env.example`: documenta as variáveis locais de pagamentos.
- `docker-compose.prod.yml`: encaminha `PAYMENT_PROVIDER` e `FAKE_GATEWAY_SECRET` para a API.
- `docs/modules/payments.md`: registra o comportamento de configuração.
- `.ai/coordination/*` e arquivos TASK/REPORT: rastreabilidade da execução.

## Implementado

- Provider de pagamentos explícito via `PAYMENT_PROVIDER=fake`.
- Falha antecipada de bootstrap em produção quando o gateway fake não recebe `FAKE_GATEWAY_SECRET`.
- Único ponto de binding do gateway em `PaymentsInfrastructureModule`.
- Correção da reexportação Nest após revisão independente.
- Nenhuma mudança em rotas, DTOs, `PaymentGatewayPort`, persistência, webhook, idempotência ou migrations.

## Decisões tomadas

- O único provider permitido nesta task permanece `fake`; não foi escolhido nem integrado PSP real.
- O contrato público e os tipos `FAKE_*` permaneceram congelados para uma task arquitetural posterior.
- A configuração pertence à composição/infrastructure, não ao domínio nem à presentation.

## Testes executados

| Comando | Resultado |
| --- | --- |
| Jest direcionado: config + gateway fake + módulo de infraestrutura | Aprovado — 3 suites, 21 testes |
| `pnpm --filter @ticket-seller/api typecheck` | Aprovado |
| `pnpm --filter @ticket-seller/api build` | Aprovado |
| `docker compose -f docker-compose.prod.yml config --quiet` com variáveis de teste | Aprovado; aviso preexistente de `API_URL` ausente |
| `git diff --check` | Aprovado |
| `pnpm --filter @ticket-seller/api lint` | Reprovado por 4 erros preexistentes em specs de finance/venues, fora do escopo |
| `.ai/scripts/validate-architecture.sh` | Reprovado por import Prisma preexistente em port de domínio de tickets, registrado na TASK-064 |
| `.ai/scripts/scan-secrets.sh` | Sinaliza string de secret fictício preexistente em teste do gateway fake; sem secret real detectado |

## Riscos identificados

- O contrato de pagamentos ainda contém vocabulário `FAKE_*`; um PSP real exigirá a task de neutralização planejada.
- As validações globais de lint e arquitetura continuam reprovadas por problemas preexistentes fora da TASK-065.
- As validações globais preexistentes devem ser corrigidas antes de uma futura liberação de produção.

## Pendências

- Planejar a neutralização do contrato de pagamentos e o registry extensível de gateways.
- Tratar os achados de lint, arquitetura e scan de secrets em tasks próprias.

## Documentação atualizada

- `.ai/tasks/TASK-065-payment-provider-configuration-hardening.md`
- `.ai/reports/TASK-065-payment-provider-configuration-hardening.md`
- `docs/modules/payments.md`
- `.ai/coordination/ACTIVE_TASKS.md`
- `.ai/coordination/OWNERSHIP.md`
- `.ai/coordination/DEPENDENCIES.md`

## Próxima tarefa recomendada

Planejar uma task de alteração de contrato para substituir os tipos e payloads `FAKE_*` por capacidades de pagamento neutras a provider, sem integrar PSP real.
