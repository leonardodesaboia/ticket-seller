# Auditoria de Conformidade Arquitetural — 2026-08-26

## Referências e método

Auditoria estática de todos os módulos produtivos contra `AGENTS.md`, `docs/ARCHITECTURE.md`, ADR-004 e TASK-064. Foram excluídos testes e arquivos gerados. A direção aceita é `presentation → application → domain`, com `infrastructure → application/domain`.

## Resultado consolidado

Todos os 14 módulos têm a topologia `domain`, `application`, `infrastructure` e `presentation`; notifications não possui presentation porque não expõe endpoint próprio. A separação semântica não é uniforme.

| Regra | Resultado | Evidência |
| --- | --- | --- |
| domain sem infraestrutura | Reprovado | `tickets/domain/ports/ticket-transfer-repository.port.ts` importa `@prisma/client` e expõe `Prisma.TransactionClient`. |
| application sem NestJS | Reprovado | 74 arquivos produtivos, em todos os módulos, importam `@nestjs/common` para `@Injectable`/`@Inject`. |
| application sem Prisma | Reprovado | 8 use cases de finance e 4 de payments importam `PrismaService`/`PrismaClient`. |
| módulo sem infraestrutura alheia | Reprovado | payments/finance instanciam repositório Prisma de organizations; venues instancia adapter Prisma de events. |
| API separada de worker/scheduler | Reprovado | notifications e finance iniciam workers por `OnModuleInit` + `setInterval` no processo HTTP. |
| guardrails automatizados | Parcial | script atual não verifica NestJS/Prisma em application nem fronteiras entre módulos. |

## Achados por módulo

| Módulo | Achados | Estado positivo |
| --- | --- | --- |
| checkin | Nest na application; importa `AdmissionPolicy` por caminho interno de tickets. | adapters locais para ticket/event. |
| events | Nest na application; `domain/publication/public-cursor.ts` importa erro de application. | Prisma isolado em adapters/repositories. |
| finance | Nest em 11 use cases; Prisma em 8; binding de infra de organizations; workers no HTTP. | ports específicos para ledger/payout. |
| identity | Nest na application; dois use cases leem `platform/config/env`. | repositórios atrás de ports. |
| inventory | Nest na application; importa port interno de events. | repository próprio de estoque. |
| media | Nest na application. | use cases não usam Prisma; storage usa port. |
| notifications | Nest na application; worker no HTTP. | email/log usam ports. |
| orders | Nest na application. | ports locais encapsulam acesso. |
| organizations | Nest na application. | repositories atrás de ports. |
| payments | Nest em 5; Prisma em 4; adapter de organizations direto; contrato `FAKE_*`. | seleção de gateway está em infrastructure. |
| platform-admin | Nest na application. | use cases sem Prisma direto; referência para ports. |
| reservations | Nest na application. | repository/adapters locais. |
| tickets | Nest na application; port de transferência expõe Prisma. | ports próprios para tickets/credenciais. |
| venues | Nest na application; port, erros e adapter internos de events. | repository próprio de venues. |

## Remediações exigidas

### P0 — domínio contaminado

Remover `Prisma.TransactionClient` do port de tickets. A aceitação atômica deve ser uma operação específica do port, implementada pelo adapter, sem expor client ou unidade de trabalho genérica ao domínio.

### P1 — application pura

Eliminar `@Injectable` e `@Inject` dos use cases. A composição Nest deve usar factories/providers nos módulos de composição. Identity deve receber configuração por port/input, não por `platform/config/env`.

### P1 — Prisma e transação em adapters

Finance: `create-payout`, `get-financial-summary`, `list-ledger-transactions`, `list-payouts`, `process-payout-webhook`, `record-chargeback`, `record-refund`, `settle-order`.

Payments: `create-payment-attempt`, `process-chargeback`, `process-payment-webhook`, `process-refund`.

Extrair ports orientados à operação. Locks, SQL nativo e transações críticas permanecem em adapters; nenhum contrato expõe tipos Prisma.

### P1 — fronteiras de módulo

Substituir bindings/imports internos entre checkin/tickets, inventory/events, payments/finance, payments/organizations, finance/organizations e venues/events por contracts públicos, facades ou eventos definidos e exportados pelo módulo proprietário. Não mover adapters Prisma para `shared` nem duplicar queries.

### P1 — workers/scheduler

Antes de mover workers, aprovar ADR com entrypoints, polling ou broker, locks distribuídos, retry/DLQ, shutdown e observabilidade. Não tratar como refactor incidental.

## Guardrails requeridos

O validador deve bloquear dependências de NestJS, Prisma, Fastify, Redis e SDKs externos em domain/application; imports de camadas superiores pelo domain; infraestrutura de outro módulo; e caminhos internos entre módulos fora de contracts públicos permitidos.

## Ordem segura

1. Corrigir P0 e ampliar o validador com testes.
2. Remover NestJS da application.
3. Extrair ports de Prisma em payments/finance, preservando concorrência e idempotência.
4. Formalizar contracts entre módulos.
5. Decidir e separar worker/scheduler por ADR/task própria.
6. Neutralizar `FAKE_*` em payments em task posterior.

## Validação executada

`bash .ai/scripts/validate-architecture.sh` reprovou pelo import Prisma no domínio de tickets. A aprovação dos demais checks não seria suficiente enquanto o script não cobrir application e fronteiras entre módulos.
