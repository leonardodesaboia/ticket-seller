# Relatório TASK-066 — Conformidade Arquitetura Hexagonal

## Status

FASES 1 e 2 PARCIAIS; FASE 3 CONCLUÍDA — READY_TO_MERGE

## Objetivo da Fase 1

Corrigir a violação P0 (Prisma no domínio de tickets), expandir o validador arquitetural para cobrir todas as camadas e criar testes isolados para o validador.

---

## Arquivos Alterados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `apps/api/src/modules/tickets/domain/ports/ticket-transfer-repository.port.ts` | Modificado | Removido `import { Prisma }` e `PrismaTransactionClient`; simplificado `accept()` |
| `apps/api/src/modules/tickets/infrastructure/repositories/prisma-ticket-transfer.repository.ts` | Modificado | Removido import de `PrismaTransactionClient`; simplificado `accept()` sem parâmetro `tx` |
| `.ai/scripts/validate-architecture.sh` | Modificado | Expandido com 4 novas verificações (ver seção Validador) |
| `.ai/scripts/validate-architecture.spec.sh` | Criado | 13 testes isolados e determinísticos para o validador |

---

## Comportamento Implementado

### 1. Domínio limpo (P0 corrigido)

**Antes:**
```typescript
// tickets/domain/ports/ticket-transfer-repository.port.ts
import { Prisma } from '@prisma/client';
export type PrismaTransactionClient = Prisma.TransactionClient;
export interface ITicketTransferRepository {
  accept(id: string, tx?: PrismaTransactionClient): Promise<void>;
  // ...
}
```

**Depois:**
```typescript
// Sem import de @prisma/client. Domínio é TypeScript puro.
export interface ITicketTransferRepository {
  accept(id: string): Promise<void>;
  acceptAtomically(params: AcceptAtomicParams): Promise<string>;
  // ...
}
```

### 2. Validador expandido — 5 verificações ativas

| Check | Camada verificada | Padrão detectado |
|---|---|---|
| `domain-infra` | `*/domain/**` | `@nestjs\|@prisma\|ioredis\|fastify\|@aws-sdk\|...` |
| `domain-upper-layer` | `*/domain/**` | `from '.*\/application\/'` |
| `application-infra` | `*/application/**` | `@nestjs\|@prisma\|ioredis\|fastify\|@aws-sdk\|...` |
| `cross-module-infra` | qualquer arquivo | `from '([../]+)[ModuleName]/infrastructure/'` |
| `controller-prisma` | `*controller.ts` | `PrismaService\|@prisma` |

### 3. Testes do validador — 13 testes, 13 passando

```
PASS: clean fixture passes (exit 0)
PASS: domain with @prisma/client import fails (exit 1)
PASS: domain with @nestjs import fails (exit 1)
PASS: application with @nestjs/common fails (exit 1)
PASS: application with @prisma/client fails (exit 1)
PASS: application with fastify import fails (exit 1)
PASS: cross-module infrastructure import fails (exit 1)
PASS: payments importing organizations/infrastructure fails (exit 1)
PASS: same-module infrastructure import passes (exit 0)
PASS: domain importing from application (upper-layer) fails (exit 1)
PASS: infrastructure with @nestjs and @prisma passes (exit 0)
PASS: presentation controller with @nestjs passes (exit 0)
PASS: module.ts importing own infrastructure passes (exit 0)
```

---

## Decisões Tomadas

### D1: `accept(id, tx?)` → `accept(id)` — tx removido do contrato público

O método `accept()` com `PrismaTransactionClient` opcional nunca foi chamado da camada de application com um argumento `tx` (confirmado por grep). A aceitação atômica é encapsulada inteiramente em `acceptAtomically()`, que usa `prisma.$transaction()` internamente dentro do adapter de infraestrutura. Remover o parâmetro da interface não altera nenhum comportamento observável.

### D2: Abordagem estrutural para cross-module — sem enumeração de módulos

O check de cross-module infra usa regex de path estrutural (`from '([../]+)[ModuleName]/infrastructure/'`) em vez de enumerar módulos dinamicamente. Isso é robusto mesmo em fixtures com um único módulo e funciona corretamente para `./infrastructure/` (mesmo módulo, permitido) vs `../events/infrastructure/` (cross-module, bloqueado).

### D3: Spec files incluídos nas verificações de `application/`

Os arquivos `.spec.ts` dentro de `application/` que importam `@nestjs/testing` são flagrados pelo validador. Isso é intencional: testes de use cases puros não deveriam precisar do TestingModule do NestJS. A correção será feita na Fase 2.

---

## Testes Executados e Resultados

| Comando | Resultado |
|---|---|
| `bash .ai/scripts/validate-architecture.spec.sh` | 13/13 PASS |
| `npx jest --testPathPattern="ticket-transfer"` | 10/10 PASS |
| `npx jest --testPathPattern="accept-transfer"` | 8/8 PASS |
| `npx jest --testPathPattern="(ticket\|checkin\|transfer\|accept)"` | 521/521 PASS |
| `pnpm --filter @ticket-seller/api typecheck` | PASS (zero erros) |
| `pnpm --filter @ticket-seller/api build` | PASS (zero erros) |
| `git diff --check` | PASS (sem whitespace issues) |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | REPROVADO (93 violações pré-existentes documentadas abaixo) |
| `pnpm --filter @ticket-seller/api lint` | 4 erros pré-existentes (não relacionados à Fase 1) |

### Violações pré-existentes detectadas pelo validador expandido

#### `[domain-upper-layer]` — 1 violação (Phase 3)

| Arquivo | Violação |
|---|---|
| `events/domain/publication/public-cursor.ts` | Importa `InvalidCursorError` de `../../application/errors/public-catalog.errors` |

#### `[application-infra]` — 88 violações em 14 módulos (Phase 2)

Todos os 14 módulos têm use cases com `@Injectable`/`@Inject` de `@nestjs/common`. Módulos com uso adicional de Prisma diretamente na application: `finance` (8 use cases), `payments` (4 use cases). A remoção de NestJS da camada application é escopo da **Fase 2**.

#### `[cross-module-infra]` — 5 violações (Phase 3)

| Arquivo | Importa de |
|---|---|
| `media/media.module.ts` | `organizations/infrastructure/repositories/prisma-organization-invitation.repository` |
| `payments/payments.module.ts` | `organizations/infrastructure/repositories/prisma-organization-invitation.repository` |
| `finance/finance.module.ts` | `organizations/infrastructure/repositories/prisma-organization-invitation.repository` |
| `venues/venues.module.ts` | `events/infrastructure/adapters/prisma-organization-access.adapter` |
| `orders/orders.module.ts` | `organizations/infrastructure/repositories/prisma-organization-invitation.repository` |

A conversão para contracts públicos é escopo da **Fase 3**.

#### Erros de lint pré-existentes (não relacionados à Fase 1)

| Arquivo | Problema |
|---|---|
| `finance/application/use-cases/record-refund.use-case.spec.ts:37,53` | `any` explícito |
| `finance/application/use-cases/record-sale.use-case.spec.ts:41` | `any` explícito |
| `venues/application/use-cases/create-venue.use-case.spec.ts:10` | Variável não usada |

---

## Preservação de Concorrência, Idempotência e Multi-tenancy

- `acceptAtomically()` permanece **inalterado** no adapter de infraestrutura. Mantém: `SELECT FOR UPDATE` no ticket, re-verificação de status dentro da transação, revogação de credentials antigas e insert da nova credential — tudo dentro de `prisma.$transaction()`.
- Nenhum parâmetro com `organizationId` foi removido ou alterado.
- Nenhuma lógica de negócio foi modificada — a mudança é exclusivamente no contrato de interface (remoção de tipo de infraestrutura da assinatura do método).

---

## Riscos e Pendências

| Risco | Severidade | Estado |
|---|---|---|
| `application/` com NestJS — injeção de dependência via framework | Alto | Pré-existente; Fase 2 |
| `finance`/`payments` com Prisma direto em use cases | Alto | Pré-existente; Fase 3 |
| `events/domain` importa de `application` | Médio | Pré-existente; Fase 3 |
| Cross-module infra em 5 módulos | Alto | Pré-existente; Fase 3 |
| Workers/scheduler no processo HTTP | Alto | Bloqueado por ADR; Fase 4 |

---

---

## Fase 2 — Application Pura (2026-08-26)

### Objetivo

Remover `@Injectable`/`@Inject` de todos os use cases nos 14 módulos, substituir `Logger` do NestJS por `ILogger`, substituir exceções HTTP por erros de aplicação, remover `PrismaService` direto da camada application.

### Infraestrutura Criada

| Arquivo | Descrição |
|---|---|
| `src/shared/kernel/logger.port.ts` | Interface `ILogger` com `log`, `warn`, `error` |
| `src/platform/observability/nest-logger.adapter.ts` | Implementação `NestLoggerAdapter` (infra) |
| `src/shared/kernel/application-errors.ts` | Hierarquia de erros: `ApplicationError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ConflictError`, `UnprocessableError`, `RateLimitError`, `ServiceUnavailableError` |
| `src/platform/http/filters/application-error.filter.ts` | Filter NestJS que mapeia `ApplicationError` para `application/problem+json` com `statusHint` |
| `src/main.ts` | Registrado `ApplicationErrorFilter` antes de `HttpExceptionFilter` |

### Finance — Ports criados para remover PrismaService da application

| Porta | Arquivo | Implementação |
|---|---|---|
| `IFinanceTransactionRunner` | `application/ports/finance-transaction-runner.port.ts` | `prisma-finance-transaction-runner.adapter.ts` |
| `IFinancialSummaryQueryPort` | `application/ports/financial-summary-query.port.ts` | `prisma-financial-summary-query.adapter.ts` |
| `ILedgerTransactionListQueryPort` | `application/ports/ledger-transaction-list-query.port.ts` | `prisma-ledger-transaction-list-query.adapter.ts` |
| `IPayoutListQueryPort` | `application/ports/payout-list-query.port.ts` | `prisma-payout-list-query.adapter.ts` |
| `IOrderSettlementQueryPort` | `application/ports/order-settlement-query.port.ts` | `prisma-order-settlement-query.adapter.ts` |

### Módulos Transformados (14 módulos, ~90 use cases)

| Módulo | Use cases | Logger | Exceções NestJS | PrismaService |
|---|---|---|---|---|
| `checkin` | 2 | — | — | — |
| `inventory` | 1 | — | — | — |
| `venues` | 2 | — | — | — |
| `reservations` | 3 | — | — | — |
| `orders` | 3 | — | — | — |
| `tickets` | 7 | — | — | — |
| `events` | 13 | — | — | — |
| `notifications` | 1 | `ILogger` | — | — |
| `payments` | 5 | `ILogger` | — | Mantido (PrismaService é infra, não domínio) |
| `organizations` | 7 | `ILogger` (invite) | `BadRequestException→ValidationError` | — |
| `media` | 3 | `ILogger` | `NotFoundException→NotFoundError`, `BadRequestException→ValidationError` | — |
| `platform-admin` | 8 | `ILogger` | `NotFoundException→NotFoundError`, `UnprocessableEntityException→UnprocessableError` | — |
| `identity` | 8 | `ILogger` (refresh) | `UnauthorizedException→UnauthorizedError`, `BadRequestException→ValidationError`, `HttpException(429)→RateLimitError`, `ServiceUnavailableException→ServiceUnavailableError` | — |
| `finance` | 12 | `ILogger` | `NotFoundException→NotFoundError`, `UnprocessableEntityException→UnprocessableError` | Removido — 5 portas criadas |

### Resultados da Fase 2

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` (full) | **0 erros** |
| `npx jest --forceExit --runInBand` (full) | **521 testes, 80 suites — PASS** |
| `validate-architecture.sh` — `[domain-infra]` | **0 violações** |
| `validate-architecture.sh` — `[application-infra]` | **0 violações** |
| `validate-architecture.sh` — `[domain-upper-layer]` | 1 pré-existente (events/domain → application/errors) |
| `validate-architecture.sh` — `[cross-module-infra]` | 5 pré-existentes (module.ts importando infra de outros módulos) |

### Violações Remanescentes (Fase 3)

As violações abaixo são **pré-existentes** (documentadas na Fase 1) e fora do escopo desta task:

| Tipo | Arquivo | Detalhe |
|---|---|---|
| `domain-upper-layer` | `events/domain/publication/public-cursor.ts` | Importa `InvalidCursorError` de `application/errors/` |
| `cross-module-infra` | `media/media.module.ts` | Importa `PrismaOrganizationInvitationRepository` de organizations |
| `cross-module-infra` | `payments/payments.module.ts` | Importa `PrismaOrganizationInvitationRepository` de organizations |
| `cross-module-infra` | `finance/finance.module.ts` | Importa `PrismaOrganizationInvitationRepository` de organizations |
| `cross-module-infra` | `venues/venues.module.ts` | Importa `PrismaOrganizationAccessAdapter` de events |
| `cross-module-infra` | `orders/orders.module.ts` | Importa `PrismaOrganizationInvitationRepository` de organizations |

A causa raiz das violações `cross-module-infra` é `OrganizationRoleGuard` precisar de `ORGANIZATION_INVITATION_REPOSITORY` — a correção correta é exportar o token via `OrganizationsModule.exports` com `useExisting`. Escopo de Fase 3.

---

## Fase 3 — Prisma e fronteiras entre módulos (2026-08-27)

### Implementado

- `OrganizationsModule` passou a publicar os contracts de acesso a membros e o adapter Prisma que os implementa. `media`, `orders`, `payments`, `finance`, `events` e `venues` consomem o módulo, sem instanciar o repositório Prisma de organizations.
- `VenuesModule` publica `venue-access.contract.ts`; events consome apenas esse contrato.
- Foram criados contracts públicos para admission de tickets, consulta pública de events e lançamento financeiro. Isso elimina imports internos em `checkin → tickets`, `inventory → events` e `payments → finance`.
- `InvalidCursorError` foi movido ao domínio de events, removendo a dependência domain → application.
- O validador passou a bloquear imports de `domain/`, `application/` ou `infrastructure/` de outro módulo; são permitidos somente contratos públicos.

### Preservação de invariantes

Nenhuma query, lock, transação, idempotência ou contrato HTTP foi alterado. Os ports preservam `organizationId` e os adapters permanecem nos módulos proprietários.

### Validação

| Comando | Resultado |
| --- | --- |
| `bash .ai/scripts/validate-architecture.spec.sh` | 14/14 PASS |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | PASS |
| `pnpm --filter @ticket-seller/api typecheck` | PASS |
| `pnpm --filter @ticket-seller/api exec jest --config jest.config.ts --forceExit --runInBand --silent` | 80 suites / 521 testes PASS |
| `git diff --check` | PASS |

## Conclusão de pagamentos — portas de operação (2026-08-27)

Os quatro casos de uso de pagamento que ainda alcançavam Prisma foram convertidos em coordenadores de aplicação. O SQL, as transações e os detalhes de composição permanecem em adapters de infraestrutura.

| Fluxo | Porta e adapter | Garantia preservada |
| --- | --- | --- |
| criação de tentativa | `IPaymentAttemptOperationPort` / `PrismaPaymentAttemptOperationAdapter` | tentativa e `payment.created.v1` são persistidos na mesma transação |
| webhook | `IPaymentWebhookOperationPort` / `PrismaPaymentWebhookOperationAdapter` | uma reentrega recupera evento ainda não finalizado; eventos processados ou de falha de reconciliação não são repetidos |
| chargeback | `IPaymentChargebackOperationPort` / `PrismaPaymentChargebackOperationAdapter` | disputas `OPEN` podem ser retomadas; somente `PROCESSED` é terminal |
| reembolso | `IPaymentRefundOperationPort` / `PrismaPaymentRefundOperationAdapter` | falhas transitórias retornam a `PENDING`; uma nova chamada reutiliza a mesma chave de idempotência do PSP |

`PaymentsModule` compõe os adapters por factories e tokens explícitos. Isso evita depender de metadata de reflexão para interfaces TypeScript e mantém `ILogger` como detalhe de infraestrutura.

Também foi removida a consulta global de existência de pedido no endpoint público de pagamento: pedido ausente e token de reserva inválido agora resultam no mesmo erro de autorização, sem expor a existência de recurso de outra organização.

### Validação final

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api typecheck` | PASS |
| `pnpm --filter @ticket-seller/api test` | PASS — 80 suites / 521 testes |
| `pnpm --filter @ticket-seller/api build` | PASS |
| `bash .ai/scripts/validate-architecture.spec.sh` | PASS — 15/15 testes |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | PASS |
| `git diff --check` | PASS |

## Próxima fase

**Fase 4** (workers/scheduler): **Bloqueada** — aguarda ADR aprovada sobre entrypoints, locks, retry/DLQ e observabilidade.

---

## Resumo de entrega — formato oficial

### Status

READY_TO_MERGE

### Arquivos alterados

- `apps/api/src/modules/payments/application/ports/payment-*-operation.port.ts`: contratos de operações transacionais da infraestrutura.
- `apps/api/src/modules/payments/infrastructure/adapters/prisma-payment-*-operation.adapter.ts`: persistência atômica, processamento e recuperação idempotente.
- `apps/api/src/modules/payments/payments.module.ts`: composição por factories e tokens de dependência explícitos.
- `apps/api/src/modules/payments/application/use-cases/create-payment-attempt.use-case.ts`: coordenação pura, sem Prisma e sem enumeração pública de pedidos.
- `.ai/scripts/validate-architecture.sh` e `.ai/scripts/validate-architecture.spec.sh`: guardrails contra dependências de infraestrutura na application e módulos cruzados.

### Implementado

As camadas de domínio e aplicação foram isoladas de NestJS, Prisma e detalhes de infraestrutura. Nos pagamentos, a tentativa e o evento de outbox são gravados na mesma transação; webhooks e chargebacks incompletos podem ser reentregues; reembolsos transitórios reutilizam a chave idempotente do PSP.

### Decisões tomadas

- Interfaces TypeScript são compostas no módulo por tokens/factories, nunca por reflexão do Nest.
- O endpoint público não diferencia pedido inexistente de token de reserva inválido.
- Falhas de processamento que não chegaram ao estado terminal permanecem reprocessáveis em vez de serem descartadas pela deduplicação.

### Testes executados

| Comando | Resultado |
| --- | --- |
| `pnpm --filter @ticket-seller/api typecheck` | aprovado |
| `pnpm --filter @ticket-seller/api test` | aprovado |
| `pnpm --filter @ticket-seller/api build` | aprovado |
| `pnpm --filter @ticket-seller/api exec eslint src/modules/payments --ext .ts` | aprovado |
| `bash .ai/scripts/validate-architecture.spec.sh` | aprovado — 15/15 |
| `bash .ai/scripts/validate-architecture.sh apps/api/src` | aprovado |
| `git diff --check` | aprovado |

### Riscos identificados

Os cenários de falha e reentrega de PSP precisam de cobertura de integração contra PostgreSQL real e um gateway de contrato antes de habilitar um provedor de produção.

### Pendências

ADR para workers/scheduler, incluindo lock distribuído, política de retry, DLQ e métricas de processamento assíncrono.

### Documentação atualizada

- `.ai/reports/TASK-066-hexagonal-architecture-conformance.md`
- `docs/CURRENT_STATE.md`

### Próxima tarefa recomendada

Definir e aprovar a ADR de workers/scheduler; então iniciar a Fase 4 com testes de integração de reentrega de pagamentos contra PostgreSQL real.
